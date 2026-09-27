"""
Hidden Markov Model (HMM) Market Regime Detection.
Classifies Gold market behavior into 3 distinct economic states:
- State 0: Low Volatility (Accumulation / Compression)
- State 1: Medium Volatility (Sustained Institutional Trend)
- State 2: High Volatility (Liquidity Run / News Expansion)
"""

from typing import Dict, Any, List
import numpy as np

try:
    from hmmlearn.hmm import GaussianHMM
except ImportError:
    GaussianHMM = None


class HMMRegimeDetector:
    """
    Gaussian Hidden Markov Model for Gold volatility and regime forecasting.
    """

    def __init__(self, n_states: int = 3, random_state: int = 42):
        self.n_states = n_states
        self.random_state = random_state
        self.model = GaussianHMM(
            n_components=n_states,
            covariance_type="diag",
            n_iter=100,
            random_state=random_state
        ) if GaussianHMM is not None else None

    def fit_predict(self, returns: List[float], atrs: List[float]) -> Dict[str, Any]:
        """
        Fits 3-state HMM on historical returns and ATR values.
        """
        if len(returns) < 50 or len(atrs) < 50:
            raise ValueError("Need at least 50 observations to calibrate HMM")

        # Feature matrix: [returns, normalized ATR]
        rets_arr = np.array(returns[-100:], dtype=np.float64)
        atrs_arr = np.array(atrs[-100:], dtype=np.float64)
        atr_norm = (atrs_arr - np.mean(atrs_arr)) / (np.std(atrs_arr) + 1e-6)

        X = np.column_stack([rets_arr, atr_norm])

        if self.model is not None:
            self.model.fit(X)
            hidden_states = self.model.predict(X)
            current_state = int(hidden_states[-1])
            posteriors = self.model.predict_proba(X)[-1].tolist()
        else:
            # Deterministic variance quantile clustering fallback
            latest_atr_z = float(atr_norm[-1])
            if latest_atr_z < -0.5:
                current_state = 0  # Low Vol
                posteriors = [0.80, 0.15, 0.05]
            elif latest_atr_z < 0.8:
                current_state = 1  # Medium Vol
                posteriors = [0.15, 0.70, 0.15]
            else:
                current_state = 2  # High Vol
                posteriors = [0.05, 0.15, 0.80]

        state_names = {
            0: "LOW_VOLATILITY_COMPRESSION",
            1: "MEDIUM_VOLATILITY_TREND",
            2: "HIGH_VOLATILITY_EXPANSION"
        }

        return {
            "currentState": current_state,
            "regimeName": state_names.get(current_state, "UNKNOWN"),
            "probabilities": [round(p, 4) for p in posteriors],
            "stateInterpretation": (
                "Market is in compression/range bound state. Expect Spring Coil buildup."
                if current_state == 0 else (
                    "Institutional trending regime. OB & FVG continuation entries prioritized."
                    if current_state == 1 else
                    "High volatility liquidity hunt. Enforce 15-minute post-news cooldown and wide wick filters."
                )
            )
        }


hmm_detector = HMMRegimeDetector()
