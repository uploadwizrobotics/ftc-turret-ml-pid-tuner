import React, { useMemo, useRef, useState } from "react";
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
        <div className="brand-mark">ML</div>
        <div>
          <div className="brand-title">Turret Tuner</div>
          <div className="brand-subtitle">FTC ML PID Dashboard</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <a href="#setup" className="nav-item active">Setup</a>
        <a href="#logging" className="nav-item">Logging</a>
        <a href="#analyze" className="nav-item">Analyze</a>
        <a href="#results" className="nav-item">Results</a>
      </nav>

      <div className="sidebar-note">
        <div className="sidebar-note-label">Model Insight</div>
        <div className="sidebar-note-text">
          Better logs create better features. Better features create better ML suggestions.
        </div>
      </div>
    </aside>
  );
}

function MetricCard({ label, value, accent = "yellow", delay = 0 }) {
  return (
    <div
      className={`metric-card metric-${accent} reveal-up-slow`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function IntroScreen({ onEnter }) {
  return (
    <section className="intro-screen">
      <div className="intro-video-layer">
        <div className="robot-scene">
          <div className="track-line track-line-1" />
          <div className="track-line track-line-2" />
          <div className="track-line track-line-3" />
          <div className="robot-silhouette">
            <div className="robot-base" />
            <div className="robot-turret" />
            <div className="robot-arm" />
            <div className="robot-glow" />
          </div>
        </div>
      </div>

      <div className="intro-overlay" />

      <div className="intro-content">
        <div className="intro-eyebrow">FTC MACHINE LEARNING</div>
        <h1 className="intro-title">Precision tuning for a smarter turret.</h1>
        <p className="intro-subtitle">
          Analyze telemetry, extract step-response features, and generate PID recommendations
          through a local ML-driven dashboard.
        </p>
        <button className="intro-btn" onClick={onEnter}>
          Get Started
        </button>
      </div>
    </section>
  );
}

export default function App() {
  const [hasEntered, setHasEntered] = useState(false);
  const [telemetryText, setTelemetryText] = useState("");
  const [file, setFile] = useState(null);
  const [currentP, setCurrentP] = useState("0.01");
  const [currentI, setCurrentI] = useState("0.0001");
  const [currentD, setCurrentD] = useState("0.001");
  const [result, setResult] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const resultsRef = useRef(null);

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
    setShowResults(false);
  };

  const revealResults = () => {
    setShowResults(true);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setShowResults(false);
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
          backgroundColor: "rgba(245, 196, 0, 0.10)",
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.28,
        },
        {
          label: "Position",
          data: result.chartData.position ?? [],
          borderColor: "#f4f4f5",
          backgroundColor: "rgba(255,255,255,0.06)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.28,
        },
        {
          label: "Error",
          data: result.chartData.error ?? [],
          borderColor: "#ff9500",
          backgroundColor: "rgba(255,149,0,0.10)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.28,
        },
      ],
    };
  }, [result]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 4200,
        easing: "easeOutQuart",
      },
      plugins: {
        legend: {
          labels: {
            color: "#f3f3f5",
          },
        },
        title: {
          display: true,
          text: "ML Telemetry Visualization",
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

  if (!hasEntered) {
    return <IntroScreen onEnter={() => setHasEntered(true)} />;
  }

  return (
    <div className="app-shell fade-app-in">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-grid" />

      <Sidebar />

      <main className="main-content">
        <section className="hero-card" id="setup">
          <div className="hero-copy">
            <div className="eyebrow">LOCALHOST MACHINE LEARNING</div>
            <h1>FTC Turret ML-Based PID Tuner</h1>
            <p>
              Convert turret telemetry into step-response features, visualize the run,
              and generate rule-based or ML-driven PID recommendations.
            </p>

            <div className="hero-badges">
              <span className="hero-badge">Feature Extraction</span>
              <span className="hero-badge">Step Segmentation</span>
              <span className="hero-badge">PID Suggestions</span>
            </div>

            <div className="hero-actions">
              <button className="primary-btn" onClick={handleLoadSample}>
                Load Sample Run
              </button>
              <a className="secondary-btn" href="#logging">
                View Logging Snippet
              </a>
              {result && !showResults && (
                <button className="accent-btn" onClick={revealResults}>
                  View Your Results
                </button>
              )}
            </div>
          </div>

          <div className="hero-panel ml-panel">
            <div className="hero-panel-title">ML pipeline</div>
            <div className="pipeline">
              <div className="pipeline-node">Logs</div>
              <div className="pipeline-line" />
              <div className="pipeline-node">Steps</div>
              <div className="pipeline-line" />
              <div className="pipeline-node">Features</div>
              <div className="pipeline-line" />
              <div className="pipeline-node">Prediction</div>
            </div>

            <ol className="hero-steps">
              <li>Place the robot in a repeatable test position.</li>
              <li>Start the turret at a known angle each run.</li>
              <li>Add the logging snippet to your TeleOp loop.</li>
              <li>Run 3 to 5 turret step moves.</li>
              <li>Copy Logcat output filtered to your PID tag.</li>
              <li>Analyze and then click to reveal results.</li>
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
              Insert this into your turret control loop after computing error and power.
            </p>

            <pre className="code-block">{LOGGING_SNIPPET}</pre>

            <div className="instruction-list">
              <div className="instruction-item">
                <span className="instruction-index">01</span>
                <span>Add the snippet to your TeleOp loop.</span>
              </div>
              <div className="instruction-item">
                <span className="instruction-index">02</span>
                <span>Run the op mode and open Android Studio Logcat.</span>
              </div>
              <div className="instruction-item">
                <span className="instruction-index">03</span>
                <span>Filter by your log tag and copy the output.</span>
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
                <div className="check-text">Keep drivetrain still during tuning.</div>
              </div>
              <div className="check-card">
                <div className="check-title">Known target steps</div>
                <div className="check-text">Use moves like 0 → 90 → 0.</div>
              </div>
              <div className="check-card">
                <div className="check-title">Consistent load</div>
                <div className="check-text">Keep payload state the same each run.</div>
              </div>
            </div>

            <div className="warning-strip">
              High-quality data improves feature extraction and helps the ML pipeline make better recommendations.
            </div>
          </div>
        </section>

        <section className="grid-two" id="analyze">
          <form className="card analyze-card" onSubmit={handleAnalyze}>
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
                className={`primary-btn button-full ${isLoading ? "is-loading" : ""}`}
                disabled={isLoading}
              >
                {isLoading ? "Running ML Analysis..." : "Analyze Run"}
              </button>
            </div>

            {result && !showResults && (
              <div className="results-cta-box reveal-up-slow">
                <div className="results-cta-text">
                  Analysis complete. Click below to reveal your model output.
                </div>
                <button type="button" className="accent-btn results-cta-btn" onClick={revealResults}>
                  View Your Results
                </button>
              </div>
            )}
          </form>

          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-eyebrow">STEP 4</div>
                <h2>What good ML input looks like</h2>
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
                <span>Power does not stay clipped the whole time.</span>
              </div>
            </div>

            <div className="mini-note">
              If the turret moves away from the target, fix sign direction before trusting the model.
            </div>
          </div>
        </section>

        {error && <div className="error-banner reveal-up-slow">{error}</div>}

        {result && showResults && (
          <>
            <section className="results-anchor" id="results" ref={resultsRef}>
              <div className="results-header reveal-up-slow">
                <div>
                  <div className="section-eyebrow">MODEL OUTPUT</div>
                  <h2>Your Results</h2>
                </div>
              </div>
            </section>

            <section className="metrics-grid">
              <MetricCard label="Rows Parsed" value={result?.parsedRows ?? "-"} delay={0} />
              <MetricCard label="Avg Overshoot %" value={result?.summary?.avg_overshoot_pct ?? "-"} delay={180} />
              <MetricCard
                label="Avg Steady-State Error"
                value={result?.summary?.avg_steady_state_error ?? "-"}
                accent="white"
                delay={360}
              />
              <MetricCard
                label="Avg Oscillation"
                value={result?.summary?.avg_oscillation_score ?? "-"}
                accent="orange"
                delay={540}
              />
              <MetricCard
                label="Avg MAE"
                value={result?.summary?.avg_mae ?? "-"}
                accent="white"
                delay={720}
              />
              <MetricCard
                label="All Improving"
                value={String(result?.summary?.all_improving ?? "-")}
                accent={result?.summary?.all_improving ? "green" : "red"}
                delay={900}
              />
            </section>

            {result?.qualityWarnings?.length > 0 && (
              <div className="card reveal-up-slow" style={{ animationDelay: "1100ms" }}>
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
              <div className="card chart-card reveal-up-slow" style={{ animationDelay: "1300ms" }}>
                <div className="section-header">
                  <div>
                    <div className="section-eyebrow">VISUALIZATION</div>
                    <h2>Telemetry flow graph</h2>
                  </div>
                </div>

                <div className="chart-wrap">
                  {chartData && (
                    <Line
                      key={showResults ? "results-visible" : "results-hidden"}
                      data={chartData}
                      options={chartOptions}
                    />
                  )}
                </div>
              </div>

              <div className="stack-column">
                <div className="card reveal-up-slow" style={{ animationDelay: "1500ms" }}>
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
                    <div className="pid-box glow-box">
                      <div className="pid-label">P</div>
                      <div className="pid-value">{result?.suggestion?.suggested_p ?? "-"}</div>
                    </div>
                    <div className="pid-box glow-box">
                      <div className="pid-label">I</div>
                      <div className="pid-value">{result?.suggestion?.suggested_i ?? "-"}</div>
                    </div>
                    <div className="pid-box glow-box">
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

                <div className="card reveal-up-slow" style={{ animationDelay: "1700ms" }}>
                  <div className="section-header">
                    <div>
                      <div className="section-eyebrow">SUMMARY</div>
                      <h2>Step-response summary</h2>
                    </div>
                  </div>

                  <div className="summary-grid">
                    <div className="summary-item">
                      <span>Detected steps</span>
                      <strong>{result?.summary?.step_count ?? "-"}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Usable steps</span>
                      <strong>{result?.summary?.usable_step_count ?? "-"}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Average rise time</span>
                      <strong>{String(result?.summary?.avg_rise_time ?? "-")}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Average settling time</span>
                      <strong>{String(result?.summary?.avg_settling_time ?? "-")}</strong>
                    </div>
                  </div>
                </div>

                <div className="card reveal-up-slow" style={{ animationDelay: "1900ms" }}>
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