import os
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

# Path to the CSV dataset containing extracted step-response features
DATASET_PATH = "datasets/step_features.csv"

# Folder where trained model files will be saved
MODEL_DIR = "models"

# Input features used by the regression models.
# These should match the same feature order expected later during inference.
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

# Target labels the models will learn to predict.
# Each one is a multiplier applied to the current PID value.
LABEL_COLUMNS = ["p_multiplier", "i_multiplier", "d_multiplier"]

# Ensure the model output directory exists before saving files
os.makedirs(MODEL_DIR, exist_ok=True)

def load_training_data():
    """
    Load the training dataset from CSV and prepare it for model training.

    Steps:
    1. Verify the dataset exists
    2. Read it into a DataFrame
    3. Keep only rows that have label values filled in
    4. Require a minimum number of labeled examples
    5. Fill missing feature values with 0.0

    Returns:
        A cleaned pandas DataFrame ready for training
    """
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

    # Read the saved step-feature dataset
    df = pd.read_csv(DATASET_PATH)

    # Only train on rows where all label columns are present.
    # Unlabeled rows are useful for logging, but not for supervised learning.
    df = df.dropna(subset=LABEL_COLUMNS)

    # Require a minimum amount of labeled data before training.
    # This helps avoid training a model on too little data.
    if len(df) < 20:
        raise ValueError("Not enough labeled rows to train a model. Add more labeled step data first.")

    # Replace missing feature values with 0.
    # This is a simple placeholder strategy so the model can train
    # even if some metrics (like rise_time or settling_time) were unavailable.
    df[FEATURE_COLUMNS] = df[FEATURE_COLUMNS].fillna(0.0)

    return df

def train_one_model(X, y, name):
    """
    Train one Random Forest regressor for a single target label.

    Args:
        X: Feature matrix
        y: Target values for one label (e.g. p_multiplier)
        name: Friendly name used in console output

    Workflow:
    1. Split data into training and testing sets
    2. Create the Random Forest model
    3. Train the model
    4. Evaluate it using mean absolute error (MAE)
    5. Return the trained model
    """
    # Hold out 20% of the data for testing so we can estimate performance
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Random Forest is a good baseline regressor for tabular feature data.
    # n_estimators controls number of trees.
    # max_depth limits tree depth to reduce overfitting somewhat.
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=8,
        random_state=42
    )

    # Train the model on the training split
    model.fit(X_train, y_train)

    # Run predictions on the held-out test split
    preds = model.predict(X_test)

    # Measure average absolute prediction error
    mae = mean_absolute_error(y_test, preds)

    # Print evaluation result for quick feedback
    print(f"{name} MAE: {mae:.6f}")

    return model

def main():
    """
    Main training pipeline.

    Steps:
    1. Load and clean the dataset
    2. Extract the feature matrix
    3. Train separate models for P, I, and D multipliers
    4. Save each trained model to disk
    """
    # Load cleaned labeled training data
    df = load_training_data()

    # Build feature matrix
    X = df[FEATURE_COLUMNS]

    # Train one separate regressor per PID multiplier target
    model_p = train_one_model(X, df["p_multiplier"], "P multiplier")
    model_i = train_one_model(X, df["i_multiplier"], "I multiplier")
    model_d = train_one_model(X, df["d_multiplier"], "D multiplier")

    # Save trained models so the FastAPI backend can load them later
    joblib.dump(model_p, os.path.join(MODEL_DIR, "model_p.pkl"))
    joblib.dump(model_i, os.path.join(MODEL_DIR, "model_i.pkl"))
    joblib.dump(model_d, os.path.join(MODEL_DIR, "model_d.pkl"))

    print("Saved trained models to models/")

# Run training only when this file is executed directly,
# not when imported as a module somewhere else.
if __name__ == "__main__":
    main()