from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import io
import re
import base64
import os
import json
from datetime import datetime

# Optional ML imports
try:
    import joblib
except ImportError:
    joblib = None

app = FastAPI(title="FTC Turret PID Tuner")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LOG_PATTERN = re.compile(
    r"time:(-?\d+\.?\d*)\s+target:(-?\d+\.?\d*)\s+position:(-?\d+\.?\d*)\s+error:(-?\d+\.?\d*)\s+power:(-?\d+\.?\d*)"
)

MODEL_DIR = "models"
DATASET_DIR = "datasets"
RUNS_DIR = "saved_runs"

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(RUNS_DIR, exist_ok=True)

MODEL_P_PATH = os.path.join(MODEL_DIR, "model_p.pkl")
MODEL_I_PATH = os.path.join(MODEL_DIR, "model_i.pkl")
MODEL_D_PATH = os.path.join(MODEL_DIR, "model_d.pkl")

FEATURE_COLUMNS = [
    "current_p",
    "current_i",
    "current_d",
    "target_step",
    "move_direction",
    "rise_time",
    "settling_time",
    "overshoot_pct",
    "steady_state_error",
    "oscillation_score",
    "mae",
    "power_sat_ratio",
    "time_to_first_movement",
]

def parse_telemetry_text(text: str) -> pd.DataFrame:
    rows = []

    for line in text.splitlines():
        match = LOG_PATTERN.search(line)
        if match:
            rows.append({
                "time": float(match.group(1)),
                "target": float(match.group(2)),
                "position": float(match.group(3)),
                "error": float(match.group(4)),
                "power": float(match.group(5)),
            })

    if not rows:
        raise ValueError("No valid telemetry lines found.")

    df = pd.DataFrame(rows).sort_values("time").reset_index(drop=True)
    return df

def detect_target_steps(df: pd.DataFrame, threshold: float = 1e-6):
    """
    Find indices where target changes enough to count as a new step.
    Returns a list of (start_idx, end_idx) ranges.
    """
    change_indices = [0]

    for i in range(1, len(df)):
        if abs(df.loc[i, "target"] - df.loc[i - 1, "target"]) > threshold:
            change_indices.append(i)

    if change_indices[-1] != len(df):
        ranges = []
        for i in range(len(change_indices)):
            start = change_indices[i]
            end = change_indices[i + 1] - 1 if i + 1 < len(change_indices) else len(df) - 1
            ranges.append((start, end))
        return ranges

    return [(0, len(df) - 1)]

def segment_steps(df: pd.DataFrame, threshold: float = 1e-6):
    """
    Create step-response segments after each target change.

    Example:
    - If target changes at row 50, the step starts there and continues
      until the next target change or end of file.
    """
    segments = []
    change_points = []

    for i in range(1, len(df)):
        if abs(df.loc[i, "target"] - df.loc[i - 1, "target"]) > threshold:
            change_points.append(i)

    # No target change means one segment, but not very useful
    if not change_points:
        return [{
            "start_idx": 0,
            "end_idx": len(df) - 1,
            "pre_target": float(df["target"].iloc[0]),
            "target": float(df["target"].iloc[-1]),
            "is_step": False,
            "df": df.copy(),
        }]

    for idx, start in enumerate(change_points):
        end = change_points[idx + 1] - 1 if idx + 1 < len(change_points) else len(df) - 1
        pre_target = float(df["target"].iloc[start - 1])
        new_target = float(df["target"].iloc[start])

        seg = df.iloc[start:end + 1].copy().reset_index(drop=True)
        seg["time"] = seg["time"] - seg["time"].iloc[0]

        segments.append({
            "start_idx": int(start),
            "end_idx": int(end),
            "pre_target": pre_target,
            "target": new_target,
            "is_step": True,
            "df": seg,
        })

    return segments

def compute_settling_time(seg_df: pd.DataFrame, target: float, tolerance_pct: float = 0.05):
    """
    Settling time based on staying within ±5% of the step magnitude.
    """
    if len(seg_df) < 3:
        return None

    step_ref = max(1.0, abs(target))
    tolerance = tolerance_pct * step_ref

    within = (seg_df["position"] - target).abs() <= tolerance

    # Find earliest point after which all remaining samples are within tolerance
    for i in range(len(within)):
        if within.iloc[i:].all():
            return float(seg_df["time"].iloc[i])

    return None

def compute_rise_time(seg_df: pd.DataFrame, start_pos: float, target: float):
    """
    Rise time to 90% of target movement.
    """
    total_move = target - start_pos
    if abs(total_move) < 1e-6:
        return None

    threshold_pos = start_pos + 0.9 * total_move

    if total_move > 0:
        crossed = seg_df[seg_df["position"] >= threshold_pos]
    else:
        crossed = seg_df[seg_df["position"] <= threshold_pos]

    if crossed.empty:
        return None

    return float(crossed["time"].iloc[0])

def compute_overshoot_pct(seg_df: pd.DataFrame, start_pos: float, target: float):
    total_move = target - start_pos
    ref = max(1.0, abs(total_move))

    if abs(total_move) < 1e-6:
        return 0.0

    if total_move > 0:
        peak = float(seg_df["position"].max())
        overshoot = max(0.0, peak - target)
    else:
        trough = float(seg_df["position"].min())
        overshoot = max(0.0, target - trough)

    return float(overshoot / ref * 100.0)

def compute_time_to_first_movement(seg_df: pd.DataFrame, start_pos: float, threshold: float = 1.0):
    moved = seg_df[(seg_df["position"] - start_pos).abs() >= threshold]
    if moved.empty:
        return None
    return float(moved["time"].iloc[0])

def extract_step_features(seg_info: dict, current_p: float, current_i: float, current_d: float) -> dict:
    seg_df = seg_info["df"]

    start_pos = float(seg_df["position"].iloc[0])
    target = float(seg_info["target"])
    pre_target = float(seg_info["pre_target"])
    target_step = float(target - pre_target)

    rise_time = compute_rise_time(seg_df, start_pos, target)
    settling_time = compute_settling_time(seg_df, target)
    overshoot_pct = compute_overshoot_pct(seg_df, start_pos, target)
    steady_state_error = float(seg_df["error"].tail(max(3, len(seg_df) // 5)).abs().mean())
    oscillation_score = int(np.sum(np.diff(np.sign(seg_df["error"])) != 0))
    mae = float(seg_df["error"].abs().mean())
    power_sat_ratio = float((seg_df["power"].abs() >= 0.98).mean())
    time_to_first_movement = compute_time_to_first_movement(seg_df, start_pos)

    move_direction = 0
    if target_step > 0:
        move_direction = 1
    elif target_step < 0:
        move_direction = -1

    final_abs_error = float(abs(seg_df["error"].iloc[-1]))
    start_abs_error = float(abs(seg_df["error"].iloc[0]))
    improving = bool(final_abs_error < start_abs_error)

    return {
        "current_p": float(current_p),
        "current_i": float(current_i),
        "current_d": float(current_d),
        "target_step": float(target_step),
        "move_direction": int(move_direction),
        "rise_time": None if rise_time is None else float(round(rise_time, 4)),
        "settling_time": None if settling_time is None else float(round(settling_time, 4)),
        "overshoot_pct": float(round(overshoot_pct, 4)),
        "steady_state_error": float(round(steady_state_error, 4)),
        "oscillation_score": int(oscillation_score),
        "mae": float(round(mae, 4)),
        "power_sat_ratio": float(round(power_sat_ratio, 4)),
        "time_to_first_movement": None if time_to_first_movement is None else float(round(time_to_first_movement, 4)),
        "improving": improving,
        "is_step": bool(seg_info["is_step"]),
        "start_idx": int(seg_info["start_idx"]),
        "end_idx": int(seg_info["end_idx"]),
        "target": float(target),
        "pre_target": float(pre_target),
    }

def summarize_segments(feature_rows: list) -> dict:
    if not feature_rows:
        return {
            "step_count": 0,
            "usable_step_count": 0,
            "avg_overshoot_pct": 0.0,
            "avg_steady_state_error": 0.0,
            "avg_oscillation_score": 0.0,
            "avg_mae": 0.0,
            "avg_rise_time": None,
            "avg_settling_time": None,
            "all_improving": False,
        }

    usable = [r for r in feature_rows if r["is_step"]]

    rows = usable if usable else feature_rows

    def avg_of(key):
        vals = [r[key] for r in rows if r[key] is not None]
        return None if not vals else round(float(np.mean(vals)), 4)

    return {
        "step_count": len(feature_rows),
        "usable_step_count": len(usable),
        "avg_overshoot_pct": avg_of("overshoot_pct") or 0.0,
        "avg_steady_state_error": avg_of("steady_state_error") or 0.0,
        "avg_oscillation_score": avg_of("oscillation_score") or 0.0,
        "avg_mae": avg_of("mae") or 0.0,
        "avg_rise_time": avg_of("rise_time"),
        "avg_settling_time": avg_of("settling_time"),
        "all_improving": bool(all(r["improving"] for r in rows)),
    }

def generate_quality_warnings(feature_rows: list, raw_df: pd.DataFrame):
    warnings = []

    if not any(r["is_step"] for r in feature_rows):
        warnings.append("No target changes detected. This run is not ideal for tuning.")

    if len(raw_df) < 15:
        warnings.append("Very few samples were logged. Capture a longer run.")

    if all(not r["improving"] for r in feature_rows):
        warnings.append("The turret appears to move away from the target. Check control sign or motor direction.")

    if any(r["power_sat_ratio"] > 0.8 for r in feature_rows):
        warnings.append("Motor power is saturated for much of the run, which can distort tuning.")

    return warnings

def rule_based_suggest(summary: dict, current_p: float, current_i: float, current_d: float):
    new_p = current_p
    new_i = current_i
    new_d = current_d
    reasons = []

    if not summary["all_improving"]:
        reasons.append("One or more steps do not move toward the target. Fix sign direction before trusting tuning suggestions.")
        return {
            "suggested_p": round(current_p, 6),
            "suggested_i": round(current_i, 6),
            "suggested_d": round(current_d, 6),
            "reasons": reasons,
            "source": "rules",
        }

    if summary["avg_overshoot_pct"] > 10:
        new_p *= 0.92
        new_d *= 1.18
        reasons.append("Average overshoot is high, so P was reduced and D was increased.")

    if summary["avg_steady_state_error"] > 3:
        new_i = current_i * 1.10 if current_i > 0 else 0.0005
        reasons.append("Steady-state error remains, so I was increased slightly.")

    if summary["avg_oscillation_score"] >= 4:
        new_p *= 0.96
        new_d *= 1.12
        reasons.append("Oscillation is present, so D was increased and P slightly reduced.")

    if summary["avg_rise_time"] is not None and summary["avg_rise_time"] > 0.8 and summary["avg_overshoot_pct"] < 5:
        new_p *= 1.08
        reasons.append("Rise time is slow with low overshoot, so P was increased slightly.")

    if not reasons:
        reasons.append("The response looks fairly stable. Only small or no changes are suggested.")

    return {
        "suggested_p": round(new_p, 6),
        "suggested_i": round(new_i, 6),
        "suggested_d": round(new_d, 6),
        "reasons": reasons,
        "source": "rules",
    }

def load_models():
    if joblib is None:
        return None, None, None

    if not (os.path.exists(MODEL_P_PATH) and os.path.exists(MODEL_I_PATH) and os.path.exists(MODEL_D_PATH)):
        return None, None, None

    try:
        model_p = joblib.load(MODEL_P_PATH)
        model_i = joblib.load(MODEL_I_PATH)
        model_d = joblib.load(MODEL_D_PATH)
        return model_p, model_i, model_d
    except Exception:
        return None, None, None

def build_model_feature_vector(summary: dict, current_p: float, current_i: float, current_d: float):
    return {
        "current_p": float(current_p),
        "current_i": float(current_i),
        "current_d": float(current_d),
        "target_step": 90.0,  # placeholder summary-level default if averaging across many steps
        "move_direction": 1,
        "rise_time": float(summary["avg_rise_time"] if summary["avg_rise_time"] is not None else 0.0),
        "settling_time": float(summary["avg_settling_time"] if summary["avg_settling_time"] is not None else 0.0),
        "overshoot_pct": float(summary["avg_overshoot_pct"]),
        "steady_state_error": float(summary["avg_steady_state_error"]),
        "oscillation_score": float(summary["avg_oscillation_score"]),
        "mae": float(summary["avg_mae"]),
        "power_sat_ratio": 0.0,
        "time_to_first_movement": 0.0,
    }

def ml_suggest(summary: dict, current_p: float, current_i: float, current_d: float):
    model_p, model_i, model_d = load_models()
    if model_p is None:
        return None

    x_dict = build_model_feature_vector(summary, current_p, current_i, current_d)
    x = pd.DataFrame([x_dict], columns=FEATURE_COLUMNS)

    try:
        p_mult = float(model_p.predict(x)[0])
        i_mult = float(model_i.predict(x)[0])
        d_mult = float(model_d.predict(x)[0])
    except Exception:
        return None

    # Safety bounds
    p_mult = max(0.80, min(1.20, p_mult))
    i_mult = max(0.80, min(1.20, i_mult))
    d_mult = max(0.80, min(1.20, d_mult))

    return {
        "suggested_p": round(current_p * p_mult, 6),
        "suggested_i": round(current_i * i_mult, 6),
        "suggested_d": round(current_d * d_mult, 6),
        "reasons": [
            "Suggested values were generated by the trained regression model.",
            "Safety bounds were applied to keep PID changes within a conservative range."
        ],
        "source": "ml",
        "multipliers": {
            "p_multiplier": round(p_mult, 4),
            "i_multiplier": round(i_mult, 4),
            "d_multiplier": round(d_mult, 4),
        }
    }

def choose_suggestion(summary: dict, current_p: float, current_i: float, current_d: float):
    # Use rules first if sign / basic quality is bad
    if not summary["all_improving"]:
        return rule_based_suggest(summary, current_p, current_i, current_d)

    ml_result = ml_suggest(summary, current_p, current_i, current_d)
    if ml_result is not None:
        return ml_result

    return rule_based_suggest(summary, current_p, current_i, current_d)

def generate_plot_base64(df: pd.DataFrame) -> str:
    plt.figure(figsize=(10, 5))
    plt.plot(df["time"], df["target"], label="Target")
    plt.plot(df["time"], df["position"], label="Position")
    plt.plot(df["time"], df["error"], label="Error")
    plt.xlabel("Time (s)")
    plt.ylabel("Value")
    plt.title("Turret PID Performance")
    plt.legend()
    plt.grid(True)

    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight")
    plt.close()
    buf.seek(0)

    return base64.b64encode(buf.read()).decode("utf-8")

def save_step_dataset(feature_rows: list):
    """
    Append step feature rows to a CSV dataset for later training.
    """
    dataset_path = os.path.join(DATASET_DIR, "step_features.csv")

    df = pd.DataFrame(feature_rows)

    # Add placeholders for supervised learning labels if not present yet
    for col in ["p_multiplier", "i_multiplier", "d_multiplier", "improvement_score"]:
        if col not in df.columns:
            df[col] = np.nan

    if os.path.exists(dataset_path):
        existing = pd.read_csv(dataset_path)
        combined = pd.concat([existing, df], ignore_index=True)
        combined.to_csv(dataset_path, index=False)
    else:
        df.to_csv(dataset_path, index=False)

def save_run_artifacts(raw_df: pd.DataFrame, feature_rows: list, summary: dict, suggestion: dict):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    raw_df.to_csv(os.path.join(RUNS_DIR, f"run_{ts}.csv"), index=False)

    with open(os.path.join(RUNS_DIR, f"run_{ts}_features.json"), "w") as f:
        json.dump({
            "summary": summary,
            "steps": feature_rows,
            "suggestion": suggestion,
        }, f, indent=2)

@app.get("/")
def root():
    return {"message": "FTC Turret PID Tuner backend is running."}

@app.get("/model-status")
def model_status():
    model_p, model_i, model_d = load_models()
    return {
        "ml_models_loaded": bool(model_p is not None),
        "feature_columns": FEATURE_COLUMNS,
        "dataset_path": os.path.join(DATASET_DIR, "step_features.csv"),
    }

@app.post("/analyze")
async def analyze_telemetry(
    telemetry_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_p: float = Form(...),
    current_i: float = Form(...),
    current_d: float = Form(...),
):
    raw_text = None

    if telemetry_text and telemetry_text.strip():
        raw_text = telemetry_text
    elif file is not None:
        raw_text = (await file.read()).decode("utf-8")
    else:
        return {"error": "Please provide telemetry text or a .txt file."}

    try:
        raw_df = parse_telemetry_text(raw_text)
    except Exception as e:
        return {"error": f"Failed to parse telemetry: {str(e)}"}

    segments = segment_steps(raw_df)
    feature_rows = [
        extract_step_features(seg, current_p, current_i, current_d)
        for seg in segments
    ]

    summary = summarize_segments(feature_rows)
    quality_warnings = generate_quality_warnings(feature_rows, raw_df)
    suggestion = choose_suggestion(summary, current_p, current_i, current_d)
    plot_base64 = generate_plot_base64(raw_df)

    save_step_dataset(feature_rows)
    save_run_artifacts(raw_df, feature_rows, summary, suggestion)

    return {
        "summary": summary,
        "qualityWarnings": quality_warnings,
        "steps": feature_rows,
        "suggestion": suggestion,
        "chartData": {
            "labels": raw_df["time"].round(3).tolist(),
            "target": raw_df["target"].round(3).tolist(),
            "position": raw_df["position"].round(3).tolist(),
            "error": raw_df["error"].round(3).tolist(),
            "power": raw_df["power"].round(3).tolist(),
        },
        "plotImageBase64": plot_base64,
        "parsedRows": int(len(raw_df)),
    }