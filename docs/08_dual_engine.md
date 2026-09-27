# 08 — Dual Engine Architecture: SpotEngine & FuturesEngine

## Overview
The platform operates on a coordinated dual-engine model separating retail Spot OTC liquidity (`OANDA:XAUUSD`) from exchange-traded institutional futures contracts (`COMEX:GC1!`).

---

## 1. SpotEngine (`server/engines/SpotEngine.ts`)
- **Symbol**: `OANDA:XAUUSD`
- **Primary Focus**: Microstructure entry timing, Fair Value Gaps (FVG), unmitigated Order Blocks (OB), session high/low liquidity sweeps.
- **Key Indicators**:
  - **Dynamic ATR(14)**: Measures instant volatility for wick protection.
  - **VWAP**: Session-anchored institutional volume-weighted average price.
  - **SMC Liquidity Scanner**: Detects Buy-Side Liquidity (BSL) and Sell-Side Liquidity (SSL) raid zones.
- **Contract Enforcement**: Enforces a strict minimum of 30 historical candles before allowing computation. Raises `DataUnavailableError` if candles are insufficient.

---

## 2. FuturesEngine (`server/engines/FuturesEngine.ts`)
- **Symbol**: `COMEX:GC1!`
- **Primary Focus**: Order flow volume confirmation, Cumulative Volume Delta (CVD), and Open Interest (OI) buildup.
- **Key Indicators**:
  - **CVD Delta**: Differentiates between true institutional absorption and retail chasing.
  - **Volume Imbalance**: Calculates institutional aggression ratio.
  - **Session Liquidity Levels**: Tracks Asian, London, and New York volume distribution.

---

## 3. Uniform Engine Contract
Both engines implement the standardized `IEngine` interface:
- **`analyze(timeframe: string)`**: Returns directional bias (`BULLISH`, `BEARISH`, `NEUTRAL`), institutional score (`0-100`), key levels, and reasons.
- **Zero Mocking Policy**: Pure calculations directly against verified SQLite OHLCV records.
