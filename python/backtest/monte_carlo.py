"""
Institutional Monte Carlo Simulation Engine.
Runs 10,000 empirical permutations/bootstraps of actual trade returns (no random walks from thin air).
Computes VaR, CVaR, confidence intervals, and drawdown distribution.
"""

from typing import List, Dict, Any
import numpy as np


class MonteCarloEngine:
    """
    Empirical bootstrap Monte Carlo resampling real trade outcomes.
    """

    def __init__(self, n_simulations: int = 10000, seed: int = 42):
        self.n_simulations = n_simulations
        self.rng = np.random.default_rng(seed)

    def run(
        self,
        trade_returns: List[float],
        initial_capital: float = 100000.0,
        horizon_trades: int = 100
    ) -> Dict[str, Any]:
        """
        Resamples actual historical trade returns across 10,000 paths.
        """
        if not trade_returns or len(trade_returns) < 5:
            raise ValueError(f"Need at least 5 trade returns to simulate, got {len(trade_returns)}")

        returns_arr = np.array(trade_returns, dtype=np.float64)
        n_trades = min(horizon_trades, max(30, len(returns_arr)))

        # Bootstrap matrix: (10,000, n_trades)
        bootstrap_indices = self.rng.integers(0, len(returns_arr), size=(self.n_simulations, n_trades))
        simulated_returns = returns_arr[bootstrap_indices]

        # Cumulative capital paths: initial_capital * cumprod(1 + returns)
        growth_factors = 1.0 + simulated_returns
        capital_paths = initial_capital * np.cumprod(growth_factors, axis=1)

        # Final capital distribution
        final_capitals = capital_paths[:, -1]
        returns_distribution = (final_capitals - initial_capital) / initial_capital

        # Calculate max drawdowns for each simulated path
        running_max = np.maximum.accumulate(capital_paths, axis=1)
        drawdowns = (running_max - capital_paths) / running_max
        max_drawdowns = np.max(drawdowns, axis=1)

        # Percentile metrics
        p5 = float(np.percentile(final_capitals, 5))
        p25 = float(np.percentile(final_capitals, 25))
        p50 = float(np.percentile(final_capitals, 50))  # Median
        p75 = float(np.percentile(final_capitals, 75))
        p95 = float(np.percentile(final_capitals, 95))

        dd_p95 = float(np.percentile(max_drawdowns, 95))
        dd_p99 = float(np.percentile(max_drawdowns, 99))

        # Value at Risk (VaR 95%) and Conditional VaR (CVaR 95%)
        var_95 = float(np.percentile(returns_distribution, 5))
        tail_returns = returns_distribution[returns_distribution <= var_95]
        cvar_95 = float(np.mean(tail_returns)) if len(tail_returns) > 0 else var_95

        prob_ruin = float(np.mean(max_drawdowns >= 0.20) * 100.0)  # Risk of 20% drawdown

        return {
            "simulations": self.n_simulations,
            "horizonTrades": n_trades,
            "initialCapital": initial_capital,
            "percentiles": {
                "p5": round(p5, 2),
                "p25": round(p25, 2),
                "median": round(p50, 2),
                "p75": round(p75, 2),
                "p95": round(p95, 2),
            },
            "maxDrawdownPercentiles": {
                "p95": round(dd_p95 * 100.0, 2),
                "p99": round(dd_p99 * 100.0, 2),
            },
            "riskMetrics": {
                "var95Pct": round(abs(var_95) * 100.0, 2),
                "cvar95Pct": round(abs(cvar_95) * 100.0, 2),
                "probDrawdownOver20Pct": round(prob_ruin, 2),
            }
        }


monte_carlo_engine = MonteCarloEngine()
