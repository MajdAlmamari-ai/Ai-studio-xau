"""
FastAPI Microservice for Institutional Quantitative Analysis & Backtesting.
Endpoints:
- GET  /api/python/health
- GET  /api/python/analysis/{symbol}/{timeframe}
- POST /api/python/backtest
"""

from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from data_loader import load_from_sqlite, DataUnavailableError
from features import calculate_atr, calculate_rsi, calculate_vwap, calculate_institutional_delta

app = FastAPI(
    title="XAUUSD SMC Quant Python API",
    description="Vectorized Polars & DuckDB Quant Engine",
    version="1.0.0"
)


class BacktestRequest(BaseModel):
    symbol: str = Field(default="OANDA:XAUUSD")
    timeframe: str = Field(default="15m")
    initialCapital: float = Field(default=10000.0, ge=100.0)
    riskRewardFloor: float = Field(default=2.0, ge=1.5)
    atrPeriod: int = Field(default=14, ge=5)
    rsiPeriod: int = Field(default=14, ge=5)


@app.get("/api/python/health")
def health_check() -> Dict[str, str]:
    """Health check endpoint to verify Python microservice status."""
    return {
        "status": "HEALTHY",
        "engine": "Polars + DuckDB",
        "service": "XAUUSD Institutional Python Quant"
    }


@app.get("/api/python/analysis/{symbol}/{timeframe}")
def get_analysis(symbol: str, timeframe: str) -> Dict[str, Any]:
    """
    Computes real quantitative features using Polars vectorized expressions.
    """
    try:
        df = load_from_sqlite(symbol=symbol, timeframe=timeframe, limit=200)
    except DataUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": str(e)}
        )

    # Compute features
    atr_series = calculate_atr(df, 14)
    rsi_series = calculate_rsi(df, 14)
    vwap_series = calculate_vwap(df)
    delta_series = calculate_institutional_delta(df)

    latest_close = float(df["close"][-1])
    latest_atr = float(atr_series[-1]) if atr_series[-1] is not None else 5.0
    latest_rsi = float(rsi_series[-1]) if rsi_series[-1] is not None else 50.0
    latest_vwap = float(vwap_series[-1]) if vwap_series[-1] is not None else latest_close
    latest_delta = float(delta_series[-1]) if delta_series[-1] is not None else 0.0

    # Trend Bias classification
    bias = "BULLISH" if latest_close > latest_vwap and latest_rsi > 50 else (
        "BEARISH" if latest_close < latest_vwap and latest_rsi < 50 else "NEUTRAL"
    )

    return {
        "status": "SUCCESS",
        "symbol": symbol,
        "timeframe": timeframe,
        "timestamp": int(df["time"][-1]),
        "metrics": {
            "close": latest_close,
            "atr14": round(latest_atr, 2),
            "rsi14": round(latest_rsi, 2),
            "vwap": round(latest_vwap, 2),
            "orderFlowDelta": round(latest_delta, 2),
            "bias": bias
        }
    }


@app.post("/api/python/backtest")
def run_backtest(req: BacktestRequest) -> Dict[str, Any]:
    """
    Runs a deterministic institutional backtest on historical candles.
    """
    try:
        df = load_from_sqlite(symbol=req.symbol, timeframe=req.timeframe, limit=500)
    except DataUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": e.code, "message": e.message}
        )

    atr = calculate_atr(df, req.atrPeriod)
    vwap = calculate_vwap(df)

    trades = []
    capital = req.initialCapital
    position = None

    # Deterministic simulation over historical bars
    closes = df["close"].to_list()
    highs = df["high"].to_list()
    lows = df["low"].to_list()
    times = df["time"].to_list()
    atr_vals = atr.to_list()
    vwap_vals = vwap.to_list()

    for i in range(req.atrPeriod, len(closes)):
        c = closes[i]
        h = highs[i]
        l = lows[i]
        t = times[i]
        current_atr = atr_vals[i] or 5.0
        current_vwap = vwap_vals[i] or c

        # If in position, check TP / SL
        if position is not None:
            if position["type"] == "BUY":
                if l <= position["sl"]:
                    # Stopped out
                    loss = position["riskAmount"]
                    capital -= loss
                    trades.append({"type": "BUY", "exit": "SL", "pnl": -loss, "time": t})
                    position = None
                elif h >= position["tp"]:
                    # Take profit hit
                    profit = position["riskAmount"] * req.riskRewardFloor
                    capital += profit
                    trades.append({"type": "BUY", "exit": "TP", "pnl": profit, "time": t})
                    position = None

            elif position["type"] == "SELL":
                if h >= position["sl"]:
                    # Stopped out
                    loss = position["riskAmount"]
                    capital -= loss
                    trades.append({"type": "SELL", "exit": "SL", "pnl": -loss, "time": t})
                    position = None
                elif l <= position["tp"]:
                    # Take profit hit
                    profit = position["riskAmount"] * req.riskRewardFloor
                    capital += profit
                    trades.append({"type": "SELL", "exit": "TP", "pnl": profit, "time": t})
                    position = None

        # Check for new entry signals if not in position
        if position is None:
            risk_amount = capital * 0.01  # Strict 1% risk per trade
            sl_distance = current_atr * 1.5

            if c > current_vwap and closes[i - 1] <= vwap_vals[i - 1]:
                # Bullish VWAP reclaim
                position = {
                    "type": "BUY",
                    "entry": c,
                    "sl": c - sl_distance,
                    "tp": c + (sl_distance * req.riskRewardFloor),
                    "riskAmount": risk_amount,
                    "time": t
                }
            elif c < current_vwap and closes[i - 1] >= vwap_vals[i - 1]:
                # Bearish VWAP rejection
                position = {
                    "type": "SELL",
                    "entry": c,
                    "sl": c + sl_distance,
                    "tp": c - (sl_distance * req.riskRewardFloor),
                    "riskAmount": risk_amount,
                    "time": t
                }

    win_trades = [tr for tr in trades if tr["pnl"] > 0]
    total_trades = len(trades)
    win_rate = (len(win_trades) / total_trades * 100.0) if total_trades > 0 else 0.0

    return {
        "status": "COMPLETED",
        "symbol": req.symbol,
        "timeframe": req.timeframe,
        "initialCapital": req.initialCapital,
        "finalCapital": round(capital, 2),
        "totalTrades": total_trades,
        "winRate": round(win_rate, 2),
        "netProfit": round(capital - req.initialCapital, 2),
        "returnPct": round(((capital - req.initialCapital) / req.initialCapital) * 100.0, 2),
        "trades": trades[-20:]  # Last 20 trades for UI preview
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
