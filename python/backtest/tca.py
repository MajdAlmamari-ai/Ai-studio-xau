"""
Transaction Cost Analysis (TCA) — Almgren-Chriss Market Impact Model.
Computes realistic market impact and execution slippage for institutional gold sizes.

Mathematical formulation:
  impact = 0.1 * volatility * sqrt(order_size / volume) * price
"""

import math
from typing import Dict, Any


class TCAModel:
    """
    Institutional TCA Model estimating market impact and execution drag.
    """

    def __init__(self, impact_factor: float = 0.1, base_fee_bps: float = 2.0):
        self.impact_factor = impact_factor
        self.base_fee_bps = base_fee_bps

    def calculate_slippage(
        self,
        order_size: float,
        adv: float,
        volatility: float,
        price: float
    ) -> float:
        """
        Calculate price slippage via Almgren-Chriss square-root formula.
        order_size: size of the order in contracts or ounces
        adv: average daily volume (or bar volume)
        volatility: annualized or bar volatility (e.g. 0.015 for 1.5%)
        price: current market price
        """
        if adv <= 0 or order_size <= 0:
            return 0.0

        participation_rate = max(1e-6, min(1.0, order_size / adv))
        # impact = 0.1 * volatility * sqrt(order_size / volume) * price
        impact = self.impact_factor * volatility * math.sqrt(participation_rate) * price
        return round(impact, 4)

    def calculate_total_cost(
        self,
        order_size: float,
        adv: float,
        volatility: float,
        price: float,
        spread: float = 0.30
    ) -> Dict[str, Any]:
        """
        Calculates total transaction cost = Commission + Half-Spread + Market Impact.
        """
        notional_value = order_size * price
        commission = notional_value * (self.base_fee_bps / 10000.0)
        half_spread_cost = (spread / 2.0) * order_size
        market_impact_per_unit = self.calculate_slippage(order_size, adv, volatility, price)
        total_market_impact = market_impact_per_unit * order_size

        total_cost = commission + half_spread_cost + total_market_impact
        effective_price = price + (total_cost / order_size)

        return {
            "notionalValue": round(notional_value, 2),
            "commission": round(commission, 2),
            "halfSpreadCost": round(half_spread_cost, 2),
            "marketImpactUnit": round(market_impact_per_unit, 4),
            "totalMarketImpact": round(total_market_impact, 2),
            "totalTransactionCost": round(total_cost, 2),
            "costBps": round((total_cost / notional_value) * 10000.0, 2),
            "effectiveExecutionPrice": round(effective_price, 2)
        }


tca_model = TCAModel()
