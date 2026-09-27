# 09 — Cross-Asset Fusion Layer & Basis Engine

## Overview
The Fusion Layer (`server/fusion/ComparisonEngine.ts` and `server/macro/BasisEngine.ts`) aligns Spot and Futures signals to uncover true institutional market posture.

---

## 1. Confluence Alignment Matrix
Signals from `SpotEngine` and `FuturesEngine` are compared across identical timeframes:
- **`FULL`**: Both engines agree on directional bias (e.g. both `BULLISH`) and the absolute score difference is $\le 15$ points. Highest conviction trade state.
- **`PARTIAL`**: Both engines agree on direction, but institutional conviction discrepancy is $> 15$ points. Requires tighter risk sizing.
- **`DIVERGENT`**: Engines disagree (e.g. Spot is `BULLISH` while Futures CVD is `BEARISH`). Indicates institutional distribution into retail breakout buying. All new signal dispatches are suppressed.

---

## 2. Futures Basis & Z-Score Analysis
- **Definition**: $\text{Basis} = \text{Futures Price} - \text{Spot Price}$
- **Market Structure**:
  - **Contango**: Futures trading above Spot ($\text{Basis} \ge 0$). Normal carrying-cost regime.
  - **Backwardation**: Spot trading at a premium over Futures ($\text{Basis} < 0$). Indicates extreme physical supply shortage or sovereign accumulation.
- **Basis Z-Score**:
  $$Z = \frac{\text{Basis}_t - \mu_{\text{Basis}}}{\sigma_{\text{Basis}}}$$
  - **`NORMAL`**: $|Z| < 1.5$
  - **`ELEVATED`**: $1.5 \le |Z| < 2.5$
  - **`EXTREME`**: $|Z| \ge 2.5$ (Arbitrage opportunity and volatility expansion alert).
