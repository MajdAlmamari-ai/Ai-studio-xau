"""
Walk-Forward Optimization and Consistency Analysis.
Splits historical series into rolling In-Sample (train) and Out-Of-Sample (test) windows.
"""

from typing import List, Dict, Any
import numpy as np
import pandas as pd


class WalkForwardOptimizer:
    """
    Evaluates institutional strategy stability across rolling out-of-sample segments.
    """

    def __init__(
        self,
        in_sample_pct: float = 0.70,
        n_windows: int = 5
    ):
        self.in_sample_pct = in_sample_pct
        self.n_windows = n_windows

    def split_windows(self, n_samples: int) -> List[Dict[str, Any]]:
        """
        Creates rolling train/test indices.
        """
        if n_samples < 50:
            raise ValueError(f"Need at least 50 samples for walk-forward, got {n_samples}")

        window_size = n_samples // self.n_windows
        is_size = int(window_size * self.in_sample_pct)
        oos_size = window_size - is_size

        windows = []
        for i in range(self.n_windows):
            start = i * window_size
            is_end = start + is_size
            oos_end = start + window_size if i < self.n_windows - 1 else n_samples

            windows.append({
                "window": i + 1,
                "in_sample": (start, is_end),
                "out_of_sample": (is_end, oos_end)
            })

        return windows

    def evaluate_consistency(
        self,
        is_metrics: List[float],
        oos_metrics: List[float]
    ) -> Dict[str, Any]:
        """
        Computes Walk-Forward Efficiency (WFE = OOS performance / IS performance).
        WFE > 0.5 indicates robust institutional generalizability.
        """
        if not is_metrics or not oos_metrics or len(is_metrics) != len(oos_metrics):
            raise ValueError("In-sample and Out-of-sample metric arrays must be equal and non-empty")

        wfes = []
        for is_m, oos_m in zip(is_metrics, oos_metrics):
            denom = max(1e-4, abs(is_m))
            wfe = oos_m / denom
            wfes.append(wfe)

        mean_wfe = float(np.mean(wfes))
        is_mean = float(np.mean(is_metrics))
        oos_mean = float(np.mean(oos_metrics))

        # Degradation ratio
        degradation = (is_mean - oos_mean) / max(1e-4, abs(is_mean))

        status = "ROBUST" if mean_wfe >= 0.60 and degradation < 0.40 else (
            "ACCEPTABLE" if mean_wfe >= 0.40 else "OVERFITTED"
        )

        return {
            "meanWFE": round(mean_wfe, 2),
            "inSampleMean": round(is_mean, 2),
            "outOfSampleMean": round(oos_mean, 2),
            "degradationPct": round(degradation * 100.0, 2),
            "status": status,
            "windowDetails": [round(w, 2) for w in wfes]
        }


walk_forward_optimizer = WalkForwardOptimizer()
