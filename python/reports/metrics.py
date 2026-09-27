"""
Comprehensive Institutional Performance Metrics Engine.
Uses Empyrical & QuantStats for Wall-Street grade risk & reward evaluation.
"""

from typing import Dict, Any, List
import pandas as pd
import numpy as np

try:
    import empyrical as ep
except ImportError:
    ep = None

try:
    import quantstats as qs
except ImportError:
    qs = None


class MetricsCalculator:
    """
    Calculates Sharpe, Sortino, Calmar, Max Drawdown, Win Rate, and Profit Factor.
    """

    def calculate_from_returns(
        self,
        returns: List[float],
        rf: float = 0.045,  # 4.5% US Treasury risk-free rate
        annualization_factor: int = 252 * 24 * 4  # 15-minute bars in a trading year
    ) -> Dict[str, Any]:
        if not returns or len(returns) < 5:
            raise ValueError("Need at least 5 return observations to compute metrics")

        ret_series = pd.Series(returns)

        # Basic statistics
        mean_ret = float(ret_series.mean())
        std_ret = float(ret_series.std())
        downside_returns = ret_series[ret_series < 0]
        downside_std = float(downside_returns.std()) if len(downside_returns) > 0 else 1e-4

        # Sharpe Ratio
        if ep is not None:
            sharpe = float(ep.sharpe_ratio(ret_series, risk_free=0.0, annualization=annualization_factor))
            sortino = float(ep.sortino_ratio(ret_series, required_return=0.0, annualization=annualization_factor))
            calmar = float(ep.calmar_ratio(ret_series, annualization=annualization_factor))
            max_dd = float(ep.max_drawdown(ret_series))
        else:
            sharpe = (mean_ret / (std_ret + 1e-9)) * np.sqrt(annualization_factor)
            sortino = (mean_ret / (downside_std + 1e-9)) * np.sqrt(annualization_factor)
            
            # Cumulative returns to find max drawdown
            cum_ret = (1 + ret_series).cumprod()
            peak = cum_ret.cummax()
            dd = (cum_ret - peak) / peak
            max_dd = float(dd.min())
            annual_ret = mean_ret * annualization_factor
            calmar = (annual_ret / abs(max_dd)) if max_dd < 0 else 0.0

        # Win Rate & Profit Factor
        winning_trades = ret_series[ret_series > 0]
        losing_trades = ret_series[ret_series < 0]

        win_rate = (len(winning_trades) / len(ret_series)) * 100.0 if len(ret_series) > 0 else 0.0
        gross_profit = float(winning_trades.sum()) if len(winning_trades) > 0 else 0.0
        gross_loss = float(abs(losing_trades.sum())) if len(losing_trades) > 0 else 1e-4
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 1.0

        return {
            "sharpeRatio": round(float(sharpe), 2),
            "sortinoRatio": round(float(sortino), 2),
            "calmarRatio": round(float(calmar), 2),
            "maxDrawdownPct": round(abs(float(max_dd)) * 100.0, 2),
            "winRatePct": round(float(win_rate), 2),
            "profitFactor": round(float(profit_factor), 2),
            "totalTrades": len(returns),
            "totalReturnPct": round(float((1 + ret_series).prod() - 1.0) * 100.0, 2)
        }


metrics_calculator = MetricsCalculator()
