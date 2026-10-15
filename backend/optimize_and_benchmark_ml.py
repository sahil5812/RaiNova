"""
ML Model Optimization & Benchmarking Suite for RaiNOva
Compares Original VotingRegressor vs Pruned/Optimized Ensemble
Evaluates: R2 Score, MAE, RMSE, Model Size, Memory Footprint, Inference Latency
"""

import os
import sys
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, VotingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from train_ensemble import load_and_prepare_real_dataset

ORIGINAL_MODEL_PATH = os.path.join(BASE_DIR, "app", "models", "mumbai_ml_ensemble.joblib")
OPTIMIZED_MODEL_PATH = os.path.join(BASE_DIR, "app", "models", "mumbai_ml_ensemble_optimized.joblib")

def benchmark_inference(model, X_sample, n_iterations=50):
    # Warmup
    _ = model.predict(X_sample[:10])
    
    times = []
    for _ in range(n_iterations):
        t0 = time.perf_counter()
        _ = model.predict(X_sample)
        t1 = time.perf_counter()
        times.append((t1 - t0) * 1000) # milliseconds
        
    avg_total_ms = np.mean(times)
    per_sample_us = (avg_total_ms / len(X_sample)) * 1000 # microseconds
    return avg_total_ms, per_sample_us

def run_optimization_and_benchmarks():
    print("=" * 65)
    print("  RaiNOva ML Optimization & Benchmark Pipeline")
    print("=" * 65)
    
    # 1. Prepare Data
    df = load_and_prepare_real_dataset()
    features = [
        "rainfall_mm_hr", "tide_level_m", "elevation_m",
        "siltation_pct", "distance_to_outfall_km", "is_subway", "traffic_volume"
    ]
    X = df[features]
    y = df["target_water_depth_cm"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # 2. Benchmark Original Model
    print("\n[1/4] Benchmarking Original Model...")
    original_size_bytes = os.path.getsize(ORIGINAL_MODEL_PATH)
    orig_bundle = joblib.load(ORIGINAL_MODEL_PATH)
    orig_model = orig_bundle["model"]
    
    orig_preds = orig_model.predict(X_test)
    orig_r2 = r2_score(y_test, orig_preds)
    orig_mae = mean_absolute_error(y_test, orig_preds)
    orig_rmse = np.sqrt(mean_squared_error(y_test, orig_preds))
    orig_lat_total, orig_lat_sample = benchmark_inference(orig_model, X_test)
    
    print(f"  -> Original Size: {original_size_bytes / (1024*1024):.2f} MB")
    print(f"  -> Original R2 Score: {orig_r2:.4f}")
    print(f"  -> Original MAE: {orig_mae:.2f} cm")
    print(f"  -> Original Latency (per sample): {orig_lat_sample:.2f} us")
    
    # 3. Train & Tune Optimized Pruned Ensemble
    print("\n[2/4] Training Optimized & Pruned Models...")
    # Technique 1: Tree depth limiting & leaf size constraints (Cost-complexity & structure pruning)
    # Technique 2: Gradient boosting efficiency tuning (subsampling + depth reduction)
    # Technique 3: Efficient estimator weighting
    opt_rf = RandomForestRegressor(
        n_estimators=45,          # Reduced from 120 (62.5% fewer trees)
        max_depth=10,             # Reduced from 14 (prevents deep redundant branch splits)
        min_samples_split=6,      # Avoids micro-leaves
        min_samples_leaf=3,       # Prunes individual noise leaves
        max_features=0.85,        # Feature subsampling for generalization
        random_state=42,
        n_jobs=-1
    )
    
    opt_gb = GradientBoostingRegressor(
        n_estimators=50,          # Reduced from 100
        learning_rate=0.1,        # Faster convergence with fewer estimators
        max_depth=4,              # Reduced from 6
        subsample=0.85,           # Stochastic gradient boosting regularization
        min_samples_leaf=4,       # Leaf pruning
        random_state=42
    )
    
    opt_ensemble = VotingRegressor(
        estimators=[('rf', opt_rf), ('gb', opt_gb)],
        weights=[0.45, 0.55]      # Emphasize faster GBDT while keeping RF robustness
    )
    
    t0_train = time.time()
    opt_ensemble.fit(X_train, y_train)
    train_duration = time.time() - t0_train
    print(f"  -> Optimized training completed in {train_duration:.2f}s")
    
    # 4. Evaluate Optimized Model
    print("\n[3/4] Evaluating Optimized Model...")
    opt_preds = opt_ensemble.predict(X_test)
    opt_r2 = r2_score(y_test, opt_preds)
    opt_mae = mean_absolute_error(y_test, opt_preds)
    opt_rmse = np.sqrt(mean_squared_error(y_test, opt_preds))
    opt_lat_total, opt_lat_sample = benchmark_inference(opt_ensemble, X_test)
    
    # Save optimized bundle with compression
    opt_bundle = {
        "model": opt_ensemble,
        "feature_names": features,
        "metrics": {
            "flood_r2": round(opt_r2, 4),
            "flood_mae_cm": round(opt_mae, 2),
            "flood_rmse_cm": round(opt_rmse, 2),
            "latency_us_per_sample": round(opt_lat_sample, 2),
            "training_samples_count": len(df),
            "algorithm": "Optimized Pruned VotingRegressor (Constrained RF + Regularized GBDT)",
            "optimization_techniques": [
                "Tree Count Reduction (120->45 RF, 100->50 GBDT)",
                "Structural Depth Pruning (RF depth 14->10, GBDT depth 6->4)",
                "Minimum Leaf Size Constraints (min_samples_leaf=3)",
                "Subsampling Regularization (subsample=0.85)",
                "Joblib zlib Level-3 Serialization Compression"
            ]
        }
    }
    
    # Save with compression (compress=3)
    joblib.dump(opt_bundle, OPTIMIZED_MODEL_PATH, compress=3)
    opt_size_bytes = os.path.getsize(OPTIMIZED_MODEL_PATH)
    
    # Also overwrite the active production model
    joblib.dump(opt_bundle, ORIGINAL_MODEL_PATH, compress=3)
    
    # 5. Display Benchmark Comparison
    print("\n" + "=" * 65)
    print("  OPTIMIZATION BENCHMARK REPORT")
    print("=" * 65)
    print(f"{'Metric':<25} | {'Original':<15} | {'Optimized':<15} | {'Delta / Improvement':<18}")
    print("-" * 78)
    
    size_reduction = ((original_size_bytes - opt_size_bytes) / original_size_bytes) * 100
    lat_speedup = ((orig_lat_sample - opt_lat_sample) / orig_lat_sample) * 100
    
    print(f"{'Model Size (MB)':<25} | {original_size_bytes/(1024*1024):<15.2f} | {opt_size_bytes/(1024*1024):<15.2f} | -{size_reduction:.1f}% (Smaller)")
    print(f"{'Inference Latency (us)':<25} | {orig_lat_sample:<15.2f} | {opt_lat_sample:<15.2f} | +{lat_speedup:.1f}% (Faster)")
    print(f"{'R2 Predictive Score':<25} | {orig_r2:<15.4f} | {opt_r2:<15.4f} | {opt_r2 - orig_r2:+.4f}")
    print(f"{'MAE (Water Depth cm)':<25} | {orig_mae:<15.2f} | {opt_mae:<15.2f} | {opt_mae - orig_mae:+.2f} cm")
    print(f"{'RMSE (cm)':<25} | {orig_rmse:<15.2f} | {opt_rmse:<15.2f} | {opt_rmse - orig_rmse:+.2f} cm")
    print("=" * 65)
    print(f"Production model successfully updated at: {ORIGINAL_MODEL_PATH}")
    print("=" * 65)

if __name__ == "__main__":
    run_optimization_and_benchmarks()
