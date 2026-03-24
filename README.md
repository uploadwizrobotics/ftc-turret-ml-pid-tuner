# FTC Turret ML PID Tuner — Local Setup Guide

This guide is for FTC team members who want to run the Turret ML PID Tuner on their own computer.

The app has two parts:

- a **Python backend** that reads telemetry and suggests PID values
- a **React frontend** that shows the UI, graph, and recommendations

---

# What this project does

This project helps you tune a turret PID controller by:

1. logging turret telemetry from your FTC robot
2. copying the Logcat telemetry into the app
3. analyzing the run
4. showing graphs and suggested PID changes

The tuner can use:

- **rule-based suggestions**
- or **ML-based suggestions** if trained model files are available

---

# What you need before starting

Make sure you have these installed on your computer:

## Required
- **Python 3.10 or newer**
- **Node.js + npm**
- **Git**
- a code editor such as **VS Code**
- the FTC project already set up in Android Studio for your robot code

## Helpful
- Android Studio
- a phone or Control Hub running your FTC robot code
- Logcat access for copying telemetry

---

# Project structure

Your project should look similar to this:

```text
turret-pid-ml-tuner/
  backend/
    main.py
    train_model.py
    requirements.txt
    venv/
    models/
    datasets/
    saved_runs/
  frontend/
    package.json
    src/
      App.js
      App.css
```

---

# Step 1 — Open the project folder

Open Terminal and go into the project root folder.

Example:

```bash
cd /path/to/turret-pid-ml-tuner
```

If you are already in the project folder, you are ready for the next step.

---

# Step 2 — Start the backend

Open a terminal window for the backend.

## Go into the backend folder

```bash
cd backend
```

## Activate the virtual environment

On Mac or Linux:

```bash
source venv/bin/activate
```

If the `venv` folder does not exist yet, create it first:

```bash
python3 -m venv venv
source venv/bin/activate
```

## Install backend dependencies if needed

```bash
pip install -r requirements.txt
```

## Run the backend locally

This project uses port **8010** for the backend:

```bash
uvicorn main:app --reload --port 8010
```

## Check that it is working

Open this in your browser:

```text
http://127.0.0.1:8010
```

You should see a message that the backend is running.

You can also check:

```text
http://127.0.0.1:8010/model-status
```

That tells you whether ML model files are loaded.

---

# Step 3 — Start the frontend

Open a **second terminal window**.

## Go into the frontend folder

From the project root:

```bash
cd frontend
```

## Install frontend dependencies if needed

```bash
npm install
```

## Run the frontend locally

This project uses port **3010** for the frontend:

```bash
PORT=3010 npm start
```

## Open the site

Go to:

```text
http://localhost:3010
```

You should see the landing page and the **Get Started** button.

---

# Step 4 — Add logging to your FTC turret code

To analyze turret behavior, your TeleOp or test OpMode must log lines in this format:

```text
time:<float> target:<float> position:<float> error:<float> power:<float>
```

Example:

```text
time:93.38 target:0.0 position:18.1 error:-18.1 power:0.30
```

## Put this in your turret control loop

Add this after you calculate:
- current position
- error
- motor power

```java
String logLine = String.format(
    "time:%.3f target:%.3f position:%.3f error:%.3f power:%.3f",
    currentTime,
    targetPosition,
    currentPosition,
    error,
    power
);

Log.i("TURRET_PID", logLine);
telemetry.addLine(logLine);
```

## Important
The tuner works best when:
- the target changes clearly
- the turret moves toward the target
- the run includes overshoot and settling
- the robot is tested in a repeatable setup

---

# Step 5 — Collect turret telemetry

On the robot:

1. run your turret TeleOp or test OpMode
2. move the turret through repeatable step targets
3. example test pattern:
   - `0 -> 90`
   - hold
   - `90 -> 0`
   - hold
   - repeat

## Best practices
- use the same start angle each run
- keep drivetrain still during turret tuning
- keep payload state the same
- log enough time to capture movement and settling

---

# Step 6 — Copy telemetry from Logcat

In Android Studio:

1. open **Logcat**
2. filter by `TURRET_PID`
3. copy the telemetry lines

You can paste raw Logcat lines directly into the app. You do **not** need to manually clean them first.

Example raw Logcat line:

```text
2026-03-11 17:07:05.833  1300-1552  RobotCore  com.qualcomm.ftcrobotcontroller  I  time:93.38 target:0.0 position:18.1 error:-18.1 power:0.30
```

---

# Step 7 — Use the app

In the frontend:

1. click **Get Started**
2. paste telemetry into the textbox
3. or upload a `.txt` file
4. enter your current `P`, `I`, and `D`
5. click **Analyze Run**
6. after the analysis finishes, click **View Your Results**

The app will then show:
- graph of target, position, and error
- summary metrics
- warnings if the run looks bad
- suggested PID values
- whether the suggestion came from rules or ML

---

# Step 8 — Understand the results

## What the metrics mean

### Rows Parsed
How many telemetry rows were successfully read.

### Avg Overshoot %
How far the turret went past the target on average.

### Avg Steady-State Error
How far away the turret stayed from the target near the end.

### Avg Oscillation
How much the error crosses back and forth around the target.

### Avg MAE
Average absolute error over the run.

### All Improving
Whether the turret generally moved toward the target during detected step responses.

---

# Step 9 — Understand “rules” vs “ml”

The suggestion box will show a source:

- `rules`
- `ml`

## `rules`
The tuner is using built-in tuning rules.

This happens when:
- no trained model files are available
- the run quality is poor
- the turret appears to move away from the target
- no usable target steps were detected

## `ml`
The tuner is using trained ML models.

This only happens when:
- trained model files exist in `backend/models/`
- the backend loads them successfully
- the run passes quality checks

---

# Step 10 — Where files are saved

The backend may save files into:

## Saved runs
```text
backend/saved_runs/
```

This can include:
- raw run CSV files
- extracted feature JSON files

## Dataset
```text
backend/datasets/step_features.csv
```

This stores extracted features for future model training.

## Models
```text
backend/models/
```

This stores trained ML model files such as:
- `model_p.pkl`
- `model_i.pkl`
- `model_d.pkl`

---

# Step 11 — Train the ML models

You only need this if your team wants to use the true ML suggestion path.

## First
Collect enough runs and label the dataset.

The training CSV must eventually include values for:
- `p_multiplier`
- `i_multiplier`
- `d_multiplier`

## Then run training

In the backend folder:

```bash
python train_model.py
```

If training succeeds, model files will be saved into:

```text
backend/models/
```

Then restart the backend:

```bash
uvicorn main:app --reload --port 8010
```

Now check:

```text
http://127.0.0.1:8010/model-status
```

If it says the models are loaded, the app can use ML suggestions on valid runs.

---

# Step 12 — Common problems and fixes

## Problem: Frontend does not open
Make sure you ran:

```bash
PORT=3010 npm start
```

And then visit:

```text
http://localhost:3010
```

## Problem: Backend does not open
Make sure you ran:

```bash
uvicorn main:app --reload --port 8010
```

And then visit:

```text
http://127.0.0.1:8010
```

## Problem: “rules” appears instead of “ml”
This usually means:
- model files are missing
- model files are not loaded
- the run was not good enough
- the turret is moving away from the target

Check:

```text
http://127.0.0.1:8010/model-status
```

## Problem: Results look wrong
Check:
- motor direction
- encoder sign
- error formula
- whether positive power moves the turret the correct way

If the turret moves away from the target, fix the control sign first.

---

# Step 13 — Recommended team workflow

For team members, use this repeatable process:

1. start backend
2. start frontend
3. run turret test on robot
4. copy Logcat telemetry
5. paste into app
6. review graph and warnings
7. apply suggested PID values
8. retest
9. compare runs
10. train models later if desired

This gives the team a consistent tuning flow.

---

# Quick start summary

## Backend terminal
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8010
```

## Frontend terminal
```bash
cd frontend
PORT=3010 npm start
```

## Open in browser
- Frontend: `http://localhost:3010`
- Backend: `http://127.0.0.1:8010`

---

# Notes for FTC team members

- Use repeatable turret tests.
- Do not trust tuning suggestions if the turret moves the wrong direction.
- Always verify sign direction before changing PID values.
- ML suggestions only work after model training and only on valid runs.
- Rule-based suggestions are still useful even before ML is trained.
