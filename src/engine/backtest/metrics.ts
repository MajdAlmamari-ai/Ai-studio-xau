/**
 * Backtest Metrics
 *
 * Computes institutional performance metrics from a list of trades.
 *
 * Rules:
 *   - NEVER return fake values.
 *   - If a metric cannot be computed (e.g., no losing trades),
 *     return null or Infinity as documented.
 *   - Deterministic. NO Math.random.
 */

import {
  BacktestMetrics,
  BacktestTrade,
} from './types';

export interface MetricsInput {
  readonly trades: ReadonlyArray<BacktestTrade>;
  readonly initialEquity: number;
  readonly finalEquity: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Compute all metrics from a list of trades.
 */
export function computeMetrics(input: MetricsInput): BacktestMetrics {
  const { trades, initialEquity, finalEquity } = input;

  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      expectancyR: 0,
      averageR: 0,
      medianR: 0,
      profitFactor: 0,
      grossProfit: 0,
      grossLoss: 0,
      netProfit: 0,
      maxDrawdownPct: 0,
      finalEquity: initialEquity,
      sharpeRatio: null,
      averageBarsHeld: 0,
      maxConsecutiveLosses: 0,
    };
  }

  const winners = trades.filter((t) => t.netPnl > 0);
  const losers = trades.filter((t) => t.netPnl < 0);

  const totalTrades = trades.length;
  const winningTrades = winners.length;
  const losingTrades = losers.length;
  const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

  const rMultiples = trades.map((t) => t.realizedR);
  const averageR = rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length;
  const medianR = median(rMultiples) ?? 0;

  const grossProfit = winners.reduce((a, t) => a + t.netPnl, 0);
  const grossLoss = Math.abs(losers.reduce((a, t) => a + t.netPnl, 0));
  const netProfit = grossProfit - grossLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity;

  const expectancyR = averageR;

  // Equity curve + max drawdown
  let equity = initialEquity;
  let peak = initialEquity;
  let maxDrawdownPct = 0;
  const equityCurve = [equity];

  for (const t of trades) {
    equity += t.netPnl;
    equityCurve.push(equity);
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak * 100 : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  }

  // Sharpe (using R multiples as proxy returns per trade)
  const meanR = averageR;
  const sdR = stdDev(rMultiples);
  const sharpeRatio = sdR !== null && sdR > 0 ? meanR / sdR : null;

  // Average bars held
  const avgBarsHeld = trades.reduce((a, t) => a + t.barsHeld, 0) / trades.length;

  // Max consecutive losses
  let maxConsecutiveLosses = 0;
  let currentStreak = 0;
  for (const t of trades) {
    if (t.netPnl < 0) {
      currentStreak++;
      if (currentStreak > maxConsecutiveLosses) {
        maxConsecutiveLosses = currentStreak;
      }
    } else {
      currentStreak = 0;
    }
  }

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    expectancyR,
    averageR,
    medianR,
    profitFactor,
    grossProfit,
    grossLoss,
    netProfit,
    maxDrawdownPct,
    finalEquity: equity,
    sharpeRatio,
    averageBarsHeld: avgBarsHeld,
    maxConsecutiveLosses,
  };
}
