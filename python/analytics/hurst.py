"""
Hurst Exponent Engine for Long-Memory & Persistence Analysis.
Detects whether Gold prices are in:
- Mean-Reverting regime (H < 0.45)
- Geometric Brownian Motion / Random Walk (0.45 <= H <= 0.55)
- Persistent Trend regime (H > 0.55)
"""

from typing import Dict, Any, List
import numpy as np

try:
    import nolds
except ImportError:
    nolds = None


class HurstEngine:
    """
    Computes Hurst Exponent using Rescaled Range (R/S) analysis.
    """

    def calculate_rs(self, price_series: List[float]) -> float:
        """
        Pure deterministic R/S algorithm for Hurst exponent calculation.
        """
        n = len(price_series)
        if n < 50:
            raise ValueError(f"Need at least 50 points for Hurst calculation, got {n}")

        series = np.array(price_series, dtype=np.float64)

        if nolds is not None:
            try:
                h = float(nolds.hurst_rs(series))
                return round(h, 4)
            except Exception:
                pass

        # Native deterministic R/S calculation across sub-windows
        window_sizes = [10, 20, int(n / 2), n]
        rs_vals = []

        for w in window_sizes:
            if w > n or w < 4:
                continue
            sub = series[:w]
            returns = np.diff(sub)
            mean_r = np.mean(returns)
            dev = returns - mean_r
            cum_dev = np.cumsum(dev)
            r = np.max(cum_dev) - np.min(cum_dev)
            s = np.std(returns)
            if s > 1e-9:
                rs_vals.append((w, r / s))

        if len(rs_vals) >= 2:
            x = np.log([item[0] for item in rs_vals])
            y = np.log([max(1e-4, item[1]) for item in rs_vals])
            slope, _ = np.polyfit(x, y, 1)
            return round(float(slope), 4)

        return 0.50

    def analyze_regime(self, price_series: List[float]) -> Dict[str, Any]:
        """
        Analyzes and classifies persistence regime.
        """
        h = self.calculate_rs(price_series)

        if h > 0.55:
            regime = "PERSISTENT_TREND"
            interpretation = "Trend following SMC models (Order Block / Break of Structure) have statistical edge."
        elif h < 0.45:
            regime = "MEAN_REVERSION"
            interpretation = "Range-bound mean reversion. Trade FVG fills and liquidity sweep rejections."
        else:
            regime = "RANDOM_WALK_NOISE"
            interpretation = "Arbitrary noise regime. Reduce position sizing and widen confluence filters."

        return {
            "hurstExponent": h,
            "regime": regime,
            "interpretation": interpretation
        }


hurst_engine = HurstEngine()
