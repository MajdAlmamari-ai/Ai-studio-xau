"""
Gamma Exposure (GEX) Engine.
Computes Net Gamma, Gamma Flip point, and Market Maker positioning from CME Gold Options open interest.

Formulas:
  Call Gamma = N'(d1) / (S * sigma * sqrt(T)) * OI_call * 100 * S
  Put Gamma  = - N'(d1) / (S * sigma * sqrt(T)) * OI_put * 100 * S
  Net GEX    = Sum(Call GEX) + Sum(Put GEX)
"""

import math
from typing import List, Dict, Any


def norm_pdf(x: float) -> float:
    """Standard normal probability density function."""
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


def calculate_d1(spot: float, strike: float, time_to_expiry: float, iv: float, r: float = 0.045) -> float:
    """Computes d1 of Black-Scholes model."""
    if spot <= 0 or strike <= 0 or time_to_expiry <= 0 or iv <= 0:
        return 0.0
    return (math.log(spot / strike) + (r + 0.5 * iv * iv) * time_to_expiry) / (iv * math.sqrt(time_to_expiry))


def calculate_option_gamma(spot: float, strike: float, time_to_expiry: float, iv: float, r: float = 0.045) -> float:
    """Gamma = N'(d1) / (S * iv * sqrt(T))"""
    if spot <= 0 or strike <= 0 or time_to_expiry <= 0 or iv <= 0:
        return 0.0
    d1 = calculate_d1(spot, strike, time_to_expiry, iv, r)
    return norm_pdf(d1) / (spot * iv * math.sqrt(time_to_expiry))


class GEXEngine:
    """
    Computes Net Gamma Profile across CME Gold strikes.
    """

    def compute_gex_profile(
        self,
        spot_price: float,
        strikes: List[float],
        call_ois: List[int],
        put_ois: List[int],
        time_to_expiry_years: float = 30.0 / 365.0,
        iv: float = 0.16  # 16% annualized gold implied volatility
    ) -> Dict[str, Any]:
        if not strikes or len(strikes) != len(call_ois) or len(strikes) != len(put_ois):
            raise ValueError("Strikes, Call OI, and Put OI arrays must be equal length and non-empty")

        total_call_gex = 0.0
        total_put_gex = 0.0
        strike_details = []

        for strike, c_oi, p_oi in zip(strikes, call_ois, put_ois):
            gamma = calculate_option_gamma(spot_price, strike, time_to_expiry_years, iv)
            # Market Maker is long call gamma (volatility stabilizing)
            call_gex = gamma * c_oi * 100 * spot_price
            # Market Maker is short put gamma (volatility accelerating)
            put_gex = -gamma * p_oi * 100 * spot_price
            net_strike_gex = call_gex + put_gex

            total_call_gex += call_gex
            total_put_gex += put_gex

            strike_details.append({
                "strike": strike,
                "callOI": c_oi,
                "putOI": p_oi,
                "netGex": round(net_strike_gex, 2)
            })

        net_gex = total_call_gex + total_put_gex

        # Find Gamma Flip strike (where cumulative GEX switches sign)
        gamma_flip = spot_price
        for item in strike_details:
            if item["netGex"] >= 0:
                gamma_flip = item["strike"]
                break

        market_regime = "LONG_GAMMA_STABILIZING" if net_gex > 0 else "SHORT_GAMMA_VOLATILITY_EXPANSION"

        return {
            "spotPrice": spot_price,
            "netGexUSD": round(net_gex, 2),
            "callGexUSD": round(total_call_gex, 2),
            "putGexUSD": round(total_put_gex, 2),
            "gammaFlipStrike": gamma_flip,
            "regime": market_regime,
            "strikesProfile": strike_details[:15]
        }


gex_engine = GEXEngine()
