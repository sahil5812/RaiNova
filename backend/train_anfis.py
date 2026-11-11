"""
Training and Validation Pipeline for Adaptive Neuro-Fuzzy Inference System (ANFIS)
Trains the 5-Layer TSK Neuro-Fuzzy Architecture directly on real Mumbai & Thane
hourly monsoon records, Arabian Sea tide measurements, and BMC chronic waterlogging hotspots.
"""

import os
import sys
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from train_ensemble import load_and_prepare_real_dataset
from app.models.anfis_model import ANFISRegressor

MODEL_OUT = os.path.join(BASE_DIR, "app", "models", "mumbai_anfis_model.joblib")


def train_and_evaluate_anfis():
    print("=" * 70)
    print("  RaiNOva — Adaptive Neuro-Fuzzy Inference System (ANFIS) Training")
    print("=" * 70)

    # 1. Load real Mumbai dataset
    df = load_and_prepare_real_dataset()
    features = [
        "rainfall_mm_hr", "tide_level_m", "elevation_m",
        "siltation_pct", "is_subway"
    ]
    X = df[features]
    y = df["target_water_depth_cm"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"Training set: {len(X_train)} samples | Test set: {len(X_test)} samples")

    # 2. Instantiate and Train ANFIS
    print("\n[1/3] Initializing and training 5-Layer TSK ANFIS model...")
    t0 = time.perf_counter()
    anfis = ANFISRegressor(
        n_mfs_per_feature=[3, 3, 3, 2, 2],
        feature_names=features,
        learning_rate=0.015,
        epochs=35,
        l2_reg=1e-3,
        random_state=42
    )
    anfis.fit(X_train, y_train)
    t_train = time.perf_counter() - t0
    print(f"ANFIS training completed in {t_train:.2f} seconds.")

    # 3. Evaluate Predictions
    print("\n[2/3] Evaluating on holdout validation test set...")
    t_inf_start = time.perf_counter()
    y_pred = anfis.predict(X_test)
    t_inf_total = (time.perf_counter() - t_inf_start) * 1000 # ms
    latency_per_sample_us = (t_inf_total / len(X_test)) * 1000 # microseconds

    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))

    print(f"==================================================")
    print(f"  ANFIS VALIDATION METRICS:")
    print(f"  -> R2 Score:                      {r2:.4f}")
    print(f"  -> Mean Absolute Error (MAE):     {mae:.2f} cm")
    print(f"  -> Root Mean Squared Error (RMSE): {rmse:.2f} cm")
    print(f"  -> Inference Latency (per item):  {latency_per_sample_us:.2f} us")
    print(f"  -> Total Fuzzy Rules:             {anfis.n_rules}")
    print(f"==================================================")

    # 4. Extract Sample Linguistic Rules
    rules = anfis.get_fuzzy_rules()
    print("\n[3/3] Sample Extracted Fuzzy Linguistic Rules for Municipal Disaster Management:")
    for i, r in enumerate(rules[:4]):
        print(f"  [Rule {r['rule_id']}] {r['rule_text']}")

    # 5. Export Model Bundle
    model_bundle = {
        "model": anfis,
        "feature_names": features,
        "algorithm": "Adaptive Neuro-Fuzzy Inference System (ANFIS - Takagi-Sugeno)",
        "metrics": {
            "r2_score": round(r2, 4),
            "mae_cm": round(mae, 2),
            "rmse_cm": round(rmse, 2),
            "latency_us": round(latency_per_sample_us, 2),
            "total_rules": anfis.n_rules,
            "training_samples": len(df),
            "data_sources": "Mumbai AWS Hourly Monsoon 2021-2024 + Arabian Sea Tide Logs + BMC Chronic Hotspots",
            "explainability": "100% Transparent Fuzzy Linguistic Rules"
        },
        "sample_rules": rules[:10]
    }

    joblib.dump(model_bundle, MODEL_OUT)
    print(f"\nSuccessfully exported production ANFIS model to:\n  {MODEL_OUT}")
    return model_bundle


if __name__ == "__main__":
    train_and_evaluate_anfis()
