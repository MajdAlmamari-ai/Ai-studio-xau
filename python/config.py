"""
Configuration module for XAUUSD SMC Quant Python Layer.
Defines database paths, parquet storage, timeframes, and institutional symbol mappings.
"""

from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = (BASE_DIR / "../db/xauusd.sqlite").resolve()
PARQUET_DIR = (BASE_DIR / "data/parquet").resolve()

# Ensure parquet directory exists
PARQUET_DIR.mkdir(parents=True, exist_ok=True)

# Standard Institutional Timeframes
TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']

# Institutional Symbols
SYMBOLS = {
    'SPOT': 'OANDA:XAUUSD',
    'FUTURES': 'COMEX:GC1!'
}

# Quant Safety Constraints
MIN_CANDLES_REQUIRED = 30
DEFAULT_ATR_PERIOD = 14
DEFAULT_RSI_PERIOD = 14
DEFAULT_ROLLING_WINDOW = 20
