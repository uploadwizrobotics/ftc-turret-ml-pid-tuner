import React, { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
  Title,
} from "chart.js";
import { Line } from "react-chartjs-2";
import "./App.css";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
  Title
);

const LOGGING_SNIPPET = `String logLine = String.format(
    "time:%.3f target:%.3f position:%.3f error:%.3f power:%.3f",
    currentTime,
    targetPosition,
    currentPosition,
    error,
    power
);

Log.i("TURRET_PID", logLine);
telemetry.addLine(logLine);`;

const SAMPLE_TELEMETRY = `2026-03-11 17:07:05.833  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.38 target:0.0 position:18.1 error:-18.1 power:0.30
2026-03-11 17:07:05.849  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.40 target:0.0 position:18.1 error:-18.1 power:0.30
2026-03-11 17:07:05.862  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.41 target:0.0 position:18.1 error:-18.1 power:0.30
2026-03-11 17:07:05.876  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.42 target:0.0 position:18.1 error:-18.1 power:0.30
2026-03-11 17:07:05.891  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.44 target:0.0 position:18.1 error:-18.1 power:0.30
2026-03-11 17:07:05.904  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.45 target:0.0 position:18.1 error:-18.1 power:0.30
2026-03-11 17:07:05.919  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.47 target:0.0 position:18.1 error:-18.1 power:0.30
2026-03-11 17:07:05.934  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.48 target:0.0 position:18.1 error:-18.1 power:0.30
2026-03-11 17:07:05.948  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.50 target:0.0 position:18.1 error:-18.1 power:0.30
2026-03-11 17:07:05.962  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.51 target:0.0 position:18.1 error:-18.1 power:0.30
2026-03-11 17:07:05.981  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.53 target:0.0 position:18.3 error:-18.3 power:0.30
2026-03-11 17:07:05.996  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.54 target:0.0 position:18.3 error:-18.3 power:0.30
2026-03-11 17:07:06.010  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.56 target:0.0 position:18.3 error:-18.3 power:0.30
2026-03-11 17:07:06.032  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.58 target:0.0 position:18.5 error:-18.5 power:0.30
2026-03-11 17:07:06.047  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.59 target:0.0 position:18.5 error:-18.5 power:0.30
2026-03-11 17:07:06.065  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.61 target:0.0 position:18.7 error:-18.7 power:0.30
2026-03-11 17:07:06.097  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.64 target:0.0 position:18.7 error:-18.7 power:0.30
2026-03-11 17:07:06.112  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.66 target:0.0 position:18.9 error:-18.9 power:0.30`;

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">T</div>
        <div>
          <div className="brand-title">Turret Tuner</div>
          <div className="brand-subtitle">FTC PID Dashboard</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <a href="#setup" className="nav-item active">Setup</a>
        <a href="#logging" className="nav-item">Logging</a>
        <a href="#analyze" className="nav-item">Analyze</a>
        <a href="#results" className="nav-item">Results</a>
      </nav>

      <div className="sidebar-note">
        <div className="sidebar-note-label">Tip</div>
        <div className="sidebar-note-text">
          Use repeatable step-response tests. Consistent data gives better tuning suggestions.
        </div>
      </div>
    </aside>
  );
}

function MetricCard({ label, value, accent = "yellow" }) {
  return (
    <div className={`metric-card metric-${accent}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

export default function App() {
  const [telemetryText, setTelemetryText] = useState("");
  const [file, setFile] = useState(null);
  const [currentP, setCurrentP] = useState("0.01");
  const [currentI, setCurrentI] = useState("0.0001");
  const [currentD, setCurrentD] = useState("0.001");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(LOGGING_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleLoadSample = () => {
    setTelemetryText(SAMPLE_TELEMETRY);
    setFile(null);
    setError("");
    setResult(null);
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("current_p", currentP);
    formData.append("current_i", currentI);
    formData.append("current_d", currentD);

    if (telemetryText.trim()) formData.append("telemetry_text", telemetryText);
    if (file) formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8010/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log("Backend response:", data);

      if (!response.ok) {
        setError(data.error || `Backend error: ${response.status}`);
        return;
      }

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!result?.chartData) return null;

    return {
      labels: result.chartData.labels ?? [],
      datasets: [
        {
          label: "Target",
          data: result.chartData.target ?? [],
          borderColor: "#f5c400",
          backgroundColor: "rgba(245, 196, 0, 0.15)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.25,
        },
        {
          label: "Position",
          data: result.chartData.position ?? [],
          borderColor: "#ffffff",
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.25,
        },
        {
          label: "Error",
          data: result.chartData.error ?? [],
          borderColor: "#ff8a00",
          backgroundColor: "rgba(255, 138, 0, 0.12)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.25,
        },
      ],
    };
  }, [result]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#f3f3f5",
          },
        },
        title: {
          display: true,
          text: "Turret Response",
          color: "#f3f3f5",
        },
      },
      scales: {
        x: {
          ticks: { color: "#a8a8ad" },
          grid: { color: "rgba(255,255,255,0.08)" },
          title: {
            display: true,
            text: "Time (s)",
            color: "#d7d7db",
          },
        },
        y: {
          ticks: { color: "#a8a8ad" },
          grid: { color: "rgba(255,255,255,0.08)" },
          title: {
            display: true,
            text: "Value",
            color: "#d7d7db",
          },
        },
      },
    };
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-content">
        <section className="hero-card" id="setup">
          <div className="hero-copy">
            <div className="eyebrow">LOCALHOST TESTING</div>
            <h1>FTC ML-Based Turret PID Tuner</h1>
            <p>
              Standardize your test, log turret telemetry, paste it here, and get
              suggested PID adjustments with visual feedback.
            </p>

            <div className="hero-actions">
              <button className="primary-btn" onClick={handleLoadSample}>
                Load Sample Run
              </button>
              <a className="secondary-btn" href="#logging">
                View Logging Snippet
              </a>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-panel-title">Recommended first-run process</div>
            <ol className="hero-steps">
              <li>Place the robot in a repeatable test position.</li>
              <li>Start the turret at a known angle each run.</li>
              <li>Add the logging snippet to your TeleOp loop.</li>
              <li>Run 3 to 5 turret step moves.</li>
              <li>Copy Logcat output filtered to your PID tag.</li>
              <li>Paste logs and analyze them here.</li>
            </ol>
          </div>
        </section>

        <section className="grid-two">
          <div className="card" id="logging">
            <div className="section-header">
              <div>
                <div className="section-eyebrow">STEP 1</div>
                <h2>Install turret logging</h2>
              </div>
              <button className="ghost-btn" onClick={handleCopySnippet}>
                {copied ? "Copied" : "Copy Snippet"}
              </button>
            </div>

            <p className="muted-text">
              Put this inside your turret control loop after computing error and motor power.
            </p>

            <pre className="code-block">{LOGGING_SNIPPET}</pre>

            <div className="instruction-list">
              <div className="instruction-item">
                <span className="instruction-index">01</span>
                <span>Add the snippet into your TeleOp loop.</span>
              </div>
              <div className="instruction-item">
                <span className="instruction-index">02</span>
                <span>Run the op mode and open Logcat in Android Studio.</span>
              </div>
              <div className="instruction-item">
                <span className="instruction-index">03</span>
                <span>Filter by your log tag, then copy the output.</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-eyebrow">STEP 2</div>
                <h2>Standard test setup</h2>
              </div>
            </div>

            <div className="check-grid">
              <div className="check-card">
                <div className="check-title">Repeatable pose</div>
                <div className="check-text">Use the same starting angle every run.</div>
              </div>
              <div className="check-card">
                <div className="check-title">Stable robot</div>
                <div className="check-text">Keep drivetrain still during turret tuning.</div>
              </div>
              <div className="check-card">
                <div className="check-title">Known target steps</div>
                <div className="check-text">Run fixed targets like 0 → 90 → 0.</div>
              </div>
              <div className="check-card">
                <div className="check-title">Consistent load</div>
                <div className="check-text">Keep payload state the same each test.</div>
              </div>
            </div>

            <div className="warning-strip">
              Use AprilTag distance/angle instructions only if your turret test truly depends on vision alignment.
            </div>
          </div>
        </section>

        <section className="grid-two" id="analyze">
          <form className="card" onSubmit={handleAnalyze}>
            <div className="section-header">
              <div>
                <div className="section-eyebrow">STEP 3</div>
                <h2>Analyze telemetry</h2>
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label>Current P</label>
                <input value={currentP} onChange={(e) => setCurrentP(e.target.value)} />
              </div>
              <div>
                <label>Current I</label>
                <input value={currentI} onChange={(e) => setCurrentI(e.target.value)} />
              </div>
              <div>
                <label>Current D</label>
                <input value={currentD} onChange={(e) => setCurrentD(e.target.value)} />
              </div>
            </div>

            <label>Paste Logcat telemetry</label>
            <textarea
              rows="14"
              value={telemetryText}
              onChange={(e) => setTelemetryText(e.target.value)}
              placeholder="Paste raw Logcat lines here..."
            />

            <label>Or upload .txt file</label>
            <input
              type="file"
              accept=".txt"
              onChange={(e) => setFile(e.target.files[0])}
            />

            <div className="button-row">
              <button
                type="button"
                className="secondary-btn button-full"
                onClick={handleLoadSample}
              >
                Load Example
              </button>
              <button
                type="submit"
                className="primary-btn button-full"
                disabled={isLoading}
              >
                {isLoading ? "Analyzing..." : "Analyze Run"}
              </button>
            </div>
          </form>

          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-eyebrow">STEP 4</div>
                <h2>What good data looks like</h2>
              </div>
            </div>

            <div className="instruction-list">
              <div className="instruction-item">
                <span className="instruction-index">A</span>
                <span>Target changes clearly at least once or twice.</span>
              </div>
              <div className="instruction-item">
                <span className="instruction-index">B</span>
                <span>Position moves toward the target after each step.</span>
              </div>
              <div className="instruction-item">
                <span className="instruction-index">C</span>
                <span>You capture overshoot and settling, not just a short slice.</span>
              </div>
              <div className="instruction-item">
                <span className="instruction-index">D</span>
                <span>Motor power is not clipped at one value the whole time.</span>
              </div>
            </div>

            <div className="mini-note">
              If the turret moves away from the target, fix sign direction before trusting PID suggestions.
            </div>
          </div>
        </section>

        {error && <div className="error-banner">{error}</div>}

        {result && (
          <>
            <section className="metrics-grid" id="results">
              <MetricCard label="Rows Parsed" value={result?.parsedRows ?? "-"} />
              <MetricCard label="Avg Overshoot %" value={result?.summary?.avg_overshoot_pct ?? "-"} />
              <MetricCard
                label="Avg Steady-State Error"
                value={result?.summary?.avg_steady_state_error ?? "-"}
                accent="white"
              />
              <MetricCard
                label="Avg Oscillation"
                value={result?.summary?.avg_oscillation_score ?? "-"}
                accent="orange"
              />
              <MetricCard
                label="Avg MAE"
                value={result?.summary?.avg_mae ?? "-"}
                accent="white"
              />
              <MetricCard
                label="All Improving"
                value={String(result?.summary?.all_improving ?? "-")}
                accent={result?.summary?.all_improving ? "green" : "red"}
              />
            </section>

            {result?.qualityWarnings?.length > 0 && (
              <div className="card">
                <div className="section-header">
                  <div>
                    <div className="section-eyebrow">RUN QUALITY</div>
                    <h2>Warnings</h2>
                  </div>
                </div>

                <div className="reason-list">
                  {result.qualityWarnings.map((warning, index) => (
                    <div className="reason-item" key={index}>
                      <span className="reason-dot" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <section className="grid-two-large">
              <div className="card chart-card">
                <div className="section-header">
                  <div>
                    <div className="section-eyebrow">VISUALIZATION</div>
                    <h2>Turret performance graph</h2>
                  </div>
                </div>

                <div className="chart-wrap">
                  {chartData && <Line data={chartData} options={chartOptions} />}
                </div>
              </div>

              <div className="stack-column">
                <div className="card">
                  <div className="section-header">
                    <div>
                      <div className="section-eyebrow">RECOMMENDATION</div>
                      <h2>Suggested PID values</h2>
                    </div>
                  </div>

                  <div className="mini-note">
                    Suggestion source: <strong>{result?.suggestion?.source ?? "unknown"}</strong>
                  </div>

                  <div className="pid-grid">
                    <div className="pid-box">
                      <div className="pid-label">P</div>
                      <div className="pid-value">{result?.suggestion?.suggested_p ?? "-"}</div>
                    </div>
                    <div className="pid-box">
                      <div className="pid-label">I</div>
                      <div className="pid-value">{result?.suggestion?.suggested_i ?? "-"}</div>
                    </div>
                    <div className="pid-box">
                      <div className="pid-label">D</div>
                      <div className="pid-value">{result?.suggestion?.suggested_d ?? "-"}</div>
                    </div>
                  </div>

                  <div className="reason-list">
                    {(result?.suggestion?.reasons ?? []).map((reason, index) => (
                      <div className="reason-item" key={index}>
                        <span className="reason-dot" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="section-header">
                    <div>
                      <div className="section-eyebrow">SUMMARY</div>
                      <h2>Step-response summary</h2>
                    </div>
                  </div>

                  <p><strong>Detected steps:</strong> {result?.summary?.step_count ?? "-"}</p>
                  <p><strong>Usable steps:</strong> {result?.summary?.usable_step_count ?? "-"}</p>
                  <p><strong>Average rise time:</strong> {String(result?.summary?.avg_rise_time ?? "-")}</p>
                  <p><strong>Average settling time:</strong> {String(result?.summary?.avg_settling_time ?? "-")}</p>
                </div>

                <div className="card">
                  <div className="section-header">
                    <div>
                      <div className="section-eyebrow">BACKEND VIEW</div>
                      <h2>Generated plot</h2>
                    </div>
                  </div>

                  {result?.plotImageBase64 && (
                    <img
                      src={`data:image/png;base64,${result.plotImageBase64}`}
                      alt="Backend plot"
                      className="backend-plot"
                    />
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}