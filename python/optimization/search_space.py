"""
Optuna Search Space Definitions for Institutional SMC Quant Models.
Enforces realistic institutional ranges and constraints.
"""

from typing import Dict, Any

try:
    import optuna
except ImportError:
    optuna = None


class SMCSearchSpace:
    """
    Defines parameter ranges for institutional order blocks, FVGs, and sweep filters.
    """

    @staticmethod
    def sample_parameters(trial: Any) -> Dict[str, Any]:
        """
        Samples trial parameters within institutional quant boundaries.
        """
        if trial is None:
            return {
                "minStrengthAtr": 1.5,
                "minGapAtrRatio": 0.8,
                "alphaSweep": 0.15,
                "cooldownMinutes": 15,
                "atrPeriod": 14,
                "rrFloor": 2.0
            }

        return {
            # Minimum momentum candle ATR multiple for Order Block creation
            "minStrengthAtr": trial.suggest_float("minStrengthAtr", 1.0, 3.0, step=0.1),
            # FVG gap size ratio relative to 14-period ATR
            "minGapAtrRatio": trial.suggest_float("minGapAtrRatio", 0.5, 2.0, step=0.1),
            # Liquidity sweep wick penetration threshold
            "alphaSweep": trial.suggest_float("alphaSweep", 0.05, 0.50, step=0.05),
            # Post-news mandatory cooldown period in minutes (institutional 15-min rule)
            "cooldownMinutes": trial.suggest_int("cooldownMinutes", 10, 30, step=5),
            # ATR lookback period
            "atrPeriod": trial.suggest_int("atrPeriod", 10, 21, step=1),
            # Mandatory risk:reward floor
            "rrFloor": trial.suggest_float("rrFloor", 2.0, 4.0, step=0.25)
        }
