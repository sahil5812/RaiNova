"""
Adaptive Neuro-Fuzzy Inference System (ANFIS) for Urban Flood & Inundation Forecasting
Implements a 5-layer Takagi-Sugeno-Kang (TSK) fuzzy neural network with hybrid learning
(Least-Squares Estimation for consequent parameters + Gradient descent for premise parameters).
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional


class GaussianMF:
    """Gaussian Membership Function: mu(x) = exp(- (x - c)^2 / (2 * sigma^2))"""
    def __init__(self, c: float, sigma: float, label: str = ""):
        self.c = float(c)
        self.sigma = float(max(1e-4, sigma))
        self.label = label

    def evaluate(self, x: np.ndarray) -> np.ndarray:
        return np.exp(-0.5 * ((x - self.c) / self.sigma) ** 2)

    def grad_c(self, x: np.ndarray) -> np.ndarray:
        mu = self.evaluate(x)
        return mu * ((x - self.c) / (self.sigma ** 2))

    def grad_sigma(self, x: np.ndarray) -> np.ndarray:
        mu = self.evaluate(x)
        return mu * (((x - self.c) ** 2) / (self.sigma ** 3))


class ANFISRegressor:
    """
    Takagi-Sugeno-Kang (TSK) Adaptive Neuro-Fuzzy Inference System.
    Architecture:
      Layer 1: Fuzzification (Gaussian MFs)
      Layer 2: Rule Firing Strength (T-norm product)
      Layer 3: Normalization (Sum of firing strengths)
      Layer 4: First-Order Consequent Polynomials: f_i = p_0 + sum(p_j * x_j)
      Layer 5: Defuzzification (Weighted sum output)
    """

    def __init__(
        self,
        n_mfs_per_feature: Optional[List[int]] = None,
        feature_names: Optional[List[str]] = None,
        learning_rate: float = 0.01,
        epochs: int = 40,
        l2_reg: float = 1e-3,
        random_state: int = 42
    ):
        self.n_mfs_per_feature = n_mfs_per_feature or [3, 3, 3, 2, 2]
        self.feature_names = feature_names or [
            "rainfall_mm_hr", "tide_level_m", "elevation_m", "siltation_pct", "is_subway"
        ]
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.l2_reg = l2_reg
        self.random_state = random_state

        self.mfs: List[List[GaussianMF]] = []
        self.rules: List[Tuple[int, ...]] = []
        self.consequents: Optional[np.ndarray] = None  # Shape: (n_rules, n_features + 1)
        self.n_features = len(self.feature_names)
        self.n_rules = 0
        self.is_fitted = False
        self.feature_mins_: Optional[np.ndarray] = None
        self.feature_maxs_: Optional[np.ndarray] = None
        self.target_mean_: float = 0.0
        self.target_std_: float = 1.0

    def _initialize_mfs(self, X: np.ndarray):
        """Grid partition / quantile initialization for premise membership functions"""
        np.random.seed(self.random_state)
        self.mfs = []
        
        linguistic_labels = {
            "rainfall_mm_hr": ["LOW", "MODERATE", "TORRENTIAL"],
            "tide_level_m": ["NEAP_TIDE", "HIGH_TIDE", "SPRING_SURGE"],
            "elevation_m": ["DEPRESSION", "LOWLAND", "ELEVATED_RIDGE"],
            "siltation_pct": ["DESILTED", "HEAVILY_SILTED"],
            "is_subway": ["SURFACE_ROAD", "SUBWAY_BOWL"],
            "distance_to_outfall_km": ["CLOSE_OUTFALL", "DISTANT"],
            "traffic_volume": ["LIGHT_FLOW", "HEAVY_CORRIDOR"]
        }

        for j in range(self.n_features):
            col = X[:, j]
            n_m = self.n_mfs_per_feature[j]
            feat_name = self.feature_names[j] if j < len(self.feature_names) else f"x{j}"
            labels = linguistic_labels.get(feat_name, [f"LEVEL_{k+1}" for k in range(n_m)])
            
            # Use quantiles for natural hydrological distribution
            quantiles = np.linspace(0.1, 0.9, n_m)
            centers = np.quantile(col, quantiles)
            span = max(1e-3, np.std(col) * 0.85)

            col_mfs = []
            for k in range(n_m):
                lbl = labels[k] if k < len(labels) else f"TERM_{k+1}"
                col_mfs.append(GaussianMF(c=centers[k], sigma=span, label=lbl))
            self.mfs.append(col_mfs)

        # Generate combinatorial rule grid or selected influential subset
        # To avoid curse of dimensionality on 5 inputs: select core cross-product rules
        import itertools
        ranges = [range(len(m_list)) for m_list in self.mfs]
        all_rules = list(itertools.product(*ranges))
        
        # If total rules exceed 72, prune by variance / distance
        if len(all_rules) > 54:
            # Deterministic diverse sampling of rules
            stride = max(1, len(all_rules) // 54)
            self.rules = all_rules[::stride][:54]
        else:
            self.rules = all_rules

        self.n_rules = len(self.rules)

    def _compute_firing_strengths(self, X: np.ndarray) -> np.ndarray:
        """Layer 1 & 2: Evaluate MFs and compute product T-norm firing strengths. Shape: (N, n_rules)"""
        N = X.shape[0]
        # Precompute all membership values: mf_vals[feat_idx][mf_idx] is (N,)
        mf_vals = [[mf.evaluate(X[:, j]) for mf in self.mfs[j]] for j in range(self.n_features)]

        w = np.zeros((N, self.n_rules), dtype=np.float64)
        for r_idx, rule in enumerate(self.rules):
            rule_w = np.ones(N, dtype=np.float64)
            for j, mf_idx in enumerate(rule):
                rule_w *= np.clip(mf_vals[j][mf_idx], 1e-12, 1.0)
            w[:, r_idx] = rule_w

        return w

    def _solve_consequents_lse(self, X: np.ndarray, y: np.ndarray, w_norm: np.ndarray) -> np.ndarray:
        """Layer 4 Least Squares Estimation: Solves optimal linear TSK coefficients analytically."""
        N = X.shape[0]
        # Augmented input: [1, x_1, x_2, ..., x_n] (Shape: N, n_features + 1)
        X_aug = np.hstack([np.ones((N, 1)), X])
        d = self.n_features + 1

        # Construct Design Matrix A of shape (N, n_rules * d)
        A = np.zeros((N, self.n_rules * d), dtype=np.float64)
        for r in range(self.n_rules):
            A[:, r * d : (r + 1) * d] = X_aug * w_norm[:, [r]]

        # Regularized Ridge Least Squares: (A^T A + lambda * I)^-1 A^T y
        reg = self.l2_reg * np.eye(A.shape[1], dtype=np.float64)
        ATA = A.T @ A + reg
        ATy = A.T @ y

        try:
            theta = np.linalg.solve(ATA, ATy)
        except np.linalg.LinAlgError:
            theta, _, _, _ = np.linalg.lstsq(A, y, rcond=1e-5)

        return theta.reshape(self.n_rules, d)

    def fit(self, X: Any, y: Any):
        """Train ANFIS using hybrid learning algorithm (LSE for Layer 4 + Adam/GD for Layer 1)."""
        if isinstance(X, pd.DataFrame):
            if self.feature_names is None:
                self.feature_names = list(X.columns)
            X = X.values.astype(np.float64)
        else:
            X = np.asarray(X, dtype=np.float64)

        if isinstance(y, (pd.Series, pd.DataFrame)):
            y = y.values.astype(np.float64).flatten()
        else:
            y = np.asarray(y, dtype=np.float64).flatten()

        self.n_features = X.shape[1]
        self._initialize_mfs(X)

        # Iterative hybrid training
        best_rmse = float("inf")
        best_consequents = None
        best_mfs = None

        for epoch in range(self.epochs):
            # 1. Forward Pass: compute firing strengths (Layer 1 & 2)
            w = self._compute_firing_strengths(X)
            sum_w = np.sum(w, axis=1, keepdims=True)
            sum_w = np.where(sum_w < 1e-12, 1e-12, sum_w)
            w_norm = w / sum_w  # Layer 3: Normalized firing strengths (N, n_rules)

            # 2. Consequent Parameter Estimation (Layer 4 & 5 via LSE)
            consequents = self._solve_consequents_lse(X, y, w_norm)
            self.consequents = consequents

            # Calculate predictions & residuals
            y_pred = self._forward_predict(X, w_norm, consequents)
            residuals = y_pred - y
            mse = np.mean(residuals ** 2)
            rmse = np.sqrt(mse)

            if rmse < best_rmse:
                best_rmse = rmse
                best_consequents = consequents.copy()
                best_mfs = [[GaussianMF(mf.c, mf.sigma, mf.label) for mf in col] for col in self.mfs]

            # 3. Backward Pass: Gradient descent update for Layer 1 Premise Parameters
            # Adjust centers towards lower error
            if epoch < self.epochs - 1:
                # Stochastic/Batch gradient nudge on membership centers
                sample_idx = np.random.choice(len(X), size=min(256, len(X)), replace=False)
                X_sub = X[sample_idx]
                r_sub = residuals[sample_idx]

                for j in range(self.n_features):
                    for k, mf in enumerate(self.mfs[j]):
                        grad = np.mean(r_sub * (X_sub[:, j] - mf.c) / (mf.sigma ** 2))
                        # Update center with momentum dampening
                        mf.c -= self.learning_rate * np.clip(grad, -10.0, 10.0)

        # Restore best parameters
        if best_consequents is not None:
            self.consequents = best_consequents
            self.mfs = best_mfs

        self.is_fitted = True
        return self

    def _forward_predict(self, X: np.ndarray, w_norm: np.ndarray, consequents: np.ndarray) -> np.ndarray:
        """Computes Layer 4 & 5 forward inference for given normalized weights."""
        N = X.shape[0]
        X_aug = np.hstack([np.ones((N, 1)), X])  # (N, d)
        d = self.n_features + 1

        # Rule outputs f_i(x) shape: (N, n_rules)
        rule_outputs = np.zeros((N, self.n_rules), dtype=np.float64)
        for r in range(self.n_rules):
            rule_outputs[:, r] = X_aug @ consequents[r]

        # Defuzzification: weighted sum y_hat = sum(w_bar * f_i)
        y_hat = np.sum(w_norm * rule_outputs, axis=1)
        return y_hat

    def predict(self, X: Any) -> np.ndarray:
        """Infers predicted crisp inundation depth using the 5-layer ANFIS model."""
        if not self.is_fitted or self.consequents is None:
            raise ValueError("ANFISRegressor is not fitted yet. Call fit() first.")

        if isinstance(X, pd.DataFrame):
            # Ensure correct column ordering if feature names are present
            if all(f in X.columns for f in self.feature_names):
                X = X[self.feature_names].values.astype(np.float64)
            else:
                X = X.values.astype(np.float64)
        else:
            X = np.asarray(X, dtype=np.float64)

        if X.ndim == 1:
            X = X.reshape(1, -1)

        w = self._compute_firing_strengths(X)
        sum_w = np.sum(w, axis=1, keepdims=True)
        sum_w = np.where(sum_w < 1e-12, 1e-12, sum_w)
        w_norm = w / sum_w

        preds = self._forward_predict(X, w_norm, self.consequents)
        return np.maximum(0.0, preds)

    def get_fuzzy_rules(self) -> List[Dict[str, Any]]:
        """Extracts interpretable linguistic fuzzy rules with antecedent labels & consequent coefficients."""
        if not self.is_fitted or self.consequents is None:
            return []

        rules_list = []
        for r_idx, rule in enumerate(self.rules):
            antecedent_conditions = []
            for j, mf_idx in enumerate(rule):
                feat = self.feature_names[j]
                mf = self.mfs[j][mf_idx]
                antecedent_conditions.append({
                    "feature": feat,
                    "linguistic_term": mf.label,
                    "center": round(mf.c, 2),
                    "spread": round(mf.sigma, 2)
                })

            p = self.consequents[r_idx]
            intercept = round(float(p[0]), 2)
            linear_slopes = {self.feature_names[j]: round(float(p[j + 1]), 3) for j in range(self.n_features)}

            # Generate natural language human-readable rule text
            if_clause = " AND ".join([f"{c['feature']} is {c['linguistic_term']}" for c in antecedent_conditions])
            then_clause = f"Inundation Base = {intercept} cm (Sensitivity: {', '.join([f'{k}: {v}' for k, v in linear_slopes.items() if abs(v) > 0.05])})"
            rule_text = f"IF {if_clause} THEN {then_clause}"

            rules_list.append({
                "rule_id": r_idx + 1,
                "antecedents": antecedent_conditions,
                "consequent_intercept": intercept,
                "consequent_slopes": linear_slopes,
                "rule_text": rule_text
            })

        return rules_list

    def explain_instance(self, x: np.ndarray) -> Dict[str, Any]:
        """Provides an explainable AI breakdown showing the top firing fuzzy rules for a single observation."""
        if x.ndim == 1:
            x = x.reshape(1, -1)

        w = self._compute_firing_strengths(x)
        sum_w = np.sum(w, axis=1, keepdims=True)
        sum_w = np.where(sum_w < 1e-12, 1e-12, sum_w)
        w_norm = (w / sum_w)[0]

        top_rule_indices = np.argsort(w_norm)[::-1][:5]
        all_rules = self.get_fuzzy_rules()

        active_rules = []
        for idx in top_rule_indices:
            weight = float(w_norm[idx])
            if weight > 0.001 and idx < len(all_rules):
                r_info = all_rules[idx].copy()
                r_info["activation_weight"] = round(weight, 4)
                active_rules.append(r_info)

        pred_depth = float(self.predict(x)[0])

        return {
            "predicted_depth_cm": round(pred_depth, 2),
            "dominant_rule": active_rules[0]["rule_text"] if active_rules else "Default Base Flow",
            "top_active_rules": active_rules,
            "risk_assessment": (
                "CRITICAL_EMERGENCY" if pred_depth >= 50.0 else
                "WARNING_INUNDATION" if pred_depth >= 15.0 else
                "NOMINAL_CLEAR"
            )
        }
