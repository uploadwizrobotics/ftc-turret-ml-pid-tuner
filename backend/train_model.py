import os
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

DATASET_PATH = "datasets/step_features.csv"
MODEL_DIR = "models"

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

LABEL_COLUMNS = ["p_multiplier", "i_multiplier", "d_multiplier"]

os.makedirs(MODEL_DIR, exist_ok=True)

def load_training_data():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

    df = pd.read_csv(DATASET_PATH)

    # Only train on rows where labels are filled in
    df = df.dropna(subset=LABEL_COLUMNS)

    if len(df) < 20:
        raise ValueError("Not enough labeled rows to train a model. Add more labeled step data first.")

    # Fill missing numeric features with 0 for now
    df[FEATURE_COLUMNS] = df[FEATURE_COLUMNS].fillna(0.0)

    return df

def train_one_model(X, y, name):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=8,
        random_state=42
    )

    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)

    print(f"{name} MAE: {mae:.6f}")
    return model

def main():
    df = load_training_data()

    X = df[FEATURE_COLUMNS]

    model_p = train_one_model(X, df["p_multiplier"], "P multiplier")
    model_i = train_one_model(X, df["i_multiplier"], "I multiplier")
    model_d = train_one_model(X, df["d_multiplier"], "D multiplier")

    joblib.dump(model_p, os.path.join(MODEL_DIR, "model_p.pkl"))
    joblib.dump(model_i, os.path.join(MODEL_DIR, "model_i.pkl"))
    joblib.dump(model_d, os.path.join(MODEL_DIR, "model_d.pkl"))

    print("Saved trained models to models/")

if __name__ == "__main__":
    main()