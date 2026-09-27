"""
High-Performance DuckDB Analytics Engine.
Queries raw parquet archives to compute institutional statistics, volume profiles, and liquidity spreads.
"""

from typing import Dict, Any, Optional
import duckdb
from data_loader import get_parquet_path, DataUnavailableError


def get_ohlcv(
    symbol: str,
    timeframe: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
) -> list[Dict[str, Any]]:
    """
    Queries parquet files via DuckDB engine for high-speed filtered OHLCV records.
    """
    file_path = get_parquet_path(symbol, timeframe)
    if not file_path.exists():
        raise DataUnavailableError(
            "PARQUET_ARCHIVE_NOT_FOUND",
            f"Parquet file {file_path} not found"
        )

    con = duckdb.connect(database=":memory:")
    query = f"SELECT * FROM read_parquet('{str(file_path)}')"
    conditions = []

    if from_date:
        conditions.append(f"time >= {int(from_date)}")
    if to_date:
        conditions.append(f"time <= {int(to_date)}")

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY time ASC"

    try:
        df = con.execute(query).pl()
        return df.to_dicts()
    finally:
        con.close()


def get_aggregated_stats(symbol: str, timeframe: str) -> Dict[str, Any]:
    """
    Returns aggregated institutional stats: Min, Max, Avg Volume, Total Volume,
    Volatility proxy using DuckDB OLAP expressions.
    """
    file_path = get_parquet_path(symbol, timeframe)
    if not file_path.exists():
        raise DataUnavailableError(
            "PARQUET_ARCHIVE_NOT_FOUND",
            f"Parquet file {file_path} not found for stats aggregation"
        )

    con = duckdb.connect(database=":memory:")
    try:
        res = con.execute(f"""
            SELECT 
                COUNT(*) as count,
                MIN(low) as lowest_price,
                MAX(high) as highest_price,
                AVG(close) as avg_price,
                SUM(volume) as total_volume,
                AVG(volume) as avg_volume,
                STDDEV_POP(close) as close_stddev
            FROM read_parquet('{str(file_path)}')
        """).fetchone()

        if not res or res[0] == 0:
            raise DataUnavailableError("EMPTY_DATASET", "Zero records in dataset")

        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "count": int(res[0]),
            "lowestPrice": round(float(res[1]), 2),
            "highestPrice": round(float(res[2]), 2),
            "avgPrice": round(float(res[3]), 2),
            "totalVolume": round(float(res[4]), 2),
            "avgVolume": round(float(res[5]), 2),
            "volatilityStdDev": round(float(res[6]), 4) if res[6] is not None else 0.0,
        }
    finally:
        con.close()
