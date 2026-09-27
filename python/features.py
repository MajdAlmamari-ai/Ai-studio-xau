"""
High-Performance Feature Engineering using Polars.
Strict rules:
- All operations are vectorized using Polars expressions (no python loops).
- No random numbers or arbitrary mock values.
- Mathematical precision matching Institutional SMC Quant specs.
"""

import polars as pl
from data_loader import DataUnavailableError


def calculate_atr(df: pl.DataFrame, period: int = 14) -> pl.Series:
    """
    Computes Average True Range (ATR) using Polars vectorized expressions.
    True Range = max(High - Low, abs(High - PrevClose), abs(Low - PrevClose))
    """
    if df is None or len(df) < period + 1:
        raise DataUnavailableError(
            "INSUFFICIENT_DATA_FOR_ATR",
            f"Need at least {period + 1} candles to calculate ATR({period})"
        )

    prev_close = df["close"].shift(1)
    tr1 = df["high"] - df["low"]
    tr2 = (df["high"] - prev_close).abs()
    tr3 = (df["low"] - prev_close).abs()

    # Vectorized max across tr1, tr2, tr3
    tr = pl.max_horizontal([tr1, tr2, tr3])

    # Rolling mean for the initial window
    atr = tr.rolling_mean(window_size=period)
    return atr.alias(f"atr_{period}")


def calculate_rsi(df: pl.DataFrame, period: int = 14) -> pl.Series:
    """
    Computes Relative Strength Index (RSI) using pure Polars vectorized expressions.
    """
    if df is None or len(df) < period + 1:
        raise DataUnavailableError(
            "INSUFFICIENT_DATA_FOR_RSI",
            f"Need at least {period + 1} candles to calculate RSI({period})"
        )

    change = df["close"].diff()
    gain = pl.when(change > 0).then(change).otherwise(0.0)
    loss = pl.when(change < 0).then(-change).otherwise(0.0)

    avg_gain = gain.rolling_mean(window_size=period)
    avg_loss = loss.rolling_mean(window_size=period)

    # RS = avg_gain / avg_loss
    rs = avg_gain / (avg_loss + 1e-9)
    rsi = 100.0 - (100.0 / (1.0 + rs))

    return rsi.alias(f"rsi_{period}")


def calculate_institutional_delta(df: pl.DataFrame) -> pl.Series:
    """
    Estimates directional order flow delta from OHLCV candles without loops.
    Approximate Buy/Sell volume based on candle body and total spread.
    """
    if df is None or len(df) == 0:
        raise DataUnavailableError("EMPTY_DATA", "Cannot compute delta on empty dataframe")

    spread = (df["high"] - df["low"]).clip(lower_bound=1e-5)
    body = df["close"] - df["open"]
    # Ratio between -1.0 and +1.0
    flow_ratio = body / spread
    delta = df["volume"] * flow_ratio
    return delta.alias("order_flow_delta")


def calculate_vwap(df: pl.DataFrame) -> pl.Series:
    """
    Volume Weighted Average Price (VWAP) across the session/dataframe.
    VWAP = cumsum(Typical Price * Volume) / cumsum(Volume)
    """
    if df is None or len(df) == 0:
        raise DataUnavailableError("EMPTY_DATA", "Cannot compute VWAP on empty dataframe")

    typical_price = (df["high"] + df["low"] + df["close"]) / 3.0
    cum_vol_price = (typical_price * df["volume"]).cum_sum()
    cum_vol = df["volume"].cum_sum().clip(lower_bound=1e-5)

    vwap = cum_vol_price / cum_vol
    return vwap.alias("vwap")
