"""
High-performance Data Loader using Polars and SQLite/Parquet.
Strict rule: Zero dummy data. Raises DataUnavailableError on insufficient or missing data.
"""

import sqlite3
from pathlib import Path
from typing import Optional
import polars as pl

from config import DB_PATH, PARQUET_DIR, MIN_CANDLES_REQUIRED


class DataUnavailableError(Exception):
    """Raised when market data is unavailable or insufficient."""
    def __init__(self, code: str, message: str):
        super().__init__(f"[DataUnavailable] {code}: {message}")
        self.code = code
        self.message = message


def load_from_sqlite(
    symbol: str,
    timeframe: str = "15m",
    limit: Optional[int] = 500
) -> pl.DataFrame:
    """
    Loads OHLCV candles from the SQLite database into a Polars DataFrame.
    """
    if not DB_PATH.exists():
        raise DataUnavailableError(
            "SQLITE_DB_NOT_FOUND",
            f"Database file does not exist at {DB_PATH}"
        )

    table_name = "spot_candles" if "XAUUSD" in symbol.upper() else "futures_candles"
    
    query = f"""
        SELECT time, open, high, low, close, volume
        FROM {table_name}
        WHERE timeframe = ?
        ORDER BY time DESC
    """
    params = [timeframe]
    if limit is not None and limit > 0:
        query += " LIMIT ?"
        params.append(limit)

    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
    except Exception as e:
        raise DataUnavailableError(
            "SQLITE_QUERY_FAILED",
            f"Failed to query SQLite for symbol {symbol}: {str(e)}"
        )

    if not rows:
        raise DataUnavailableError(
            "INSUFFICIENT_CANDLES",
            f"No candles found for symbol {symbol} with timeframe {timeframe}"
        )

    # Sort ascending for chronological series analysis
    rows.reverse()

    schema = {
        "time": pl.Int64,
        "open": pl.Float64,
        "high": pl.Float64,
        "low": pl.Float64,
        "close": pl.Float64,
        "volume": pl.Float64,
    }

    df = pl.DataFrame(
        {
            "time": [r[0] for r in rows],
            "open": [float(r[1]) for r in rows],
            "high": [float(r[2]) for r in rows],
            "low": [float(r[3]) for r in rows],
            "close": [float(r[4]) for r in rows],
            "volume": [float(r[5]) for r in rows],
        },
        schema=schema,
    )

    if len(df) < MIN_CANDLES_REQUIRED:
        raise DataUnavailableError(
            "INSUFFICIENT_CANDLES",
            f"Need at least {MIN_CANDLES_REQUIRED} candles, found {len(df)}"
        )

    return df


def get_parquet_path(symbol: str, timeframe: str) -> Path:
    """Returns safe filesystem path for a given symbol and timeframe parquet file."""
    clean_sym = symbol.replace(":", "_").replace("/", "_")
    return PARQUET_DIR / f"{clean_sym}_{timeframe}.parquet"


def save_to_parquet(df: pl.DataFrame, symbol: str, timeframe: str) -> Path:
    """Saves a Polars DataFrame to Parquet format for fast vectorized reads."""
    if df is None or len(df) == 0:
        raise DataUnavailableError("EMPTY_DATAFRAME", "Cannot save empty DataFrame to parquet")

    file_path = get_parquet_path(symbol, timeframe)
    df.write_parquet(file_path, compression="zstd")
    return file_path


def load_from_parquet(symbol: str, timeframe: str) -> pl.DataFrame:
    """Reads OHLCV dataset from Parquet file."""
    file_path = get_parquet_path(symbol, timeframe)
    if not file_path.exists():
        raise DataUnavailableError(
            "PARQUET_FILE_NOT_FOUND",
            f"Parquet storage for {symbol} ({timeframe}) not found at {file_path}"
        )

    df = pl.read_parquet(file_path)
    if len(df) < MIN_CANDLES_REQUIRED:
        raise DataUnavailableError(
            "INSUFFICIENT_PARQUET_CANDLES",
            f"Parquet file contains {len(df)} candles, requires {MIN_CANDLES_REQUIRED}"
        )

    return df
