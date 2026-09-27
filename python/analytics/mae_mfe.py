"""
Maximum Adverse Excursion (MAE) and Maximum Favorable Excursion (MFE) Analysis.
Analyzes trade paths to discover optimal Stop Loss and Take Profit thresholds.
"""

from typing import List, Dict, Any
import numpy as np


class MAEMFEAnalyzer:
    """
    Evaluates adverse vs favorable movement during the lifetime of each executed trade.
    """

    def analyze_trades(
        self,
        trades: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        trades format:
        [
          { "type": "BUY"|"SELL", "entry": float, "exit": float, "highest": float, "lowest": float, "pnl": float }
        ]
        """
        if not trades or len(trades) < 3:
            raise ValueError("Need at least 3 trades with excursion data")

        mae_list = []
        mfe_list = []

        for tr in trades:
            entry = tr["entry"]
            highest = tr.get("highest", max(entry, tr["exit"]))
            lowest = tr.get("lowest", min(entry, tr["exit"]))
            is_buy = tr.get("type", "BUY") == "BUY"

            if is_buy:
                # Adverse: how far down did it go before exit?
                mae = max(0.0, entry - lowest)
                # Favorable: how far up did it peak?
                mfe = max(0.0, highest - entry)
            else:
                # Sell adverse: how far up did it go?
                mae = max(0.0, highest - entry)
                # Sell favorable: how far down did it go?
                mfe = max(0.0, entry - lowest)

            mae_list.append(mae)
            mfe_list.append(mfe)

        mae_arr = np.array(mae_list)
        mfe_arr = np.array(mfe_list)

        # Optimal stop loss is around 90th percentile of winning trades MAE
        wins_indices = [i for i, tr in enumerate(trades) if tr.get("pnl", 0) > 0]
        if wins_indices:
            win_mae = mae_arr[wins_indices]
            recommended_sl = float(np.percentile(win_mae, 90))
        else:
            recommended_sl = float(np.percentile(mae_arr, 75))

        # Recommended TP is around 75th percentile of MFE
        recommended_tp = float(np.percentile(mfe_arr, 75))

        return {
            "totalTradesAnalyzed": len(trades),
            "maeDistribution": {
                "mean": round(float(np.mean(mae_arr)), 2),
                "p50": round(float(np.median(mae_arr)), 2),
                "p90": round(float(np.percentile(mae_arr, 90)), 2),
                "max": round(float(np.max(mae_arr)), 2)
            },
            "mfeDistribution": {
                "mean": round(float(np.mean(mfe_arr)), 2),
                "p50": round(float(np.median(mfe_arr)), 2),
                "p75": round(float(np.percentile(mfe_arr, 75)), 2),
                "max": round(float(np.max(mfe_arr)), 2)
            },
            "recommendations": {
                "suggestedOptimalSLDistance": round(max(1.5, recommended_sl * 1.1), 2),
                "suggestedOptimalTPDistance": round(max(3.0, recommended_tp * 0.9), 2),
                "suggestedRiskRewardRatio": round(
                    max(2.0, (recommended_tp * 0.9) / max(1.0, recommended_sl * 1.1)), 2
                )
            }
        }


mae_mfe_analyzer = MAEMFEAnalyzer()
