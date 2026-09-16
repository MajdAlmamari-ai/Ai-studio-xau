/**
 * Backtest Engine — Event-Driven Loop
 *
 * For each decision time t:
 *   1. Use ONLY candles with time <= t (visible data).
 *   2. Run real SMC engine on visible slice.
 *   3. If signal, simulate using future candles.
 *   4. Record the trade.
 *
 * CRITICAL: NO LOOKAHEAD.
 * Deterministic. NO Math.random.
 */

import { runRealSMCEngine } from '../engine';
import { simulateTrade } from './simulator';
import { computeMetrics } from './metrics';
import {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  DEFAULT_BACKTEST_CONFIG,
  NormalizedCandle,
  TradeDirection,
} from './types';

export interface BacktestInput {
  readonly candles: ReadonlyArray<NormalizedCandle>;
  readonly config?: BacktestConfig;
}

interface EntryDecision {
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  confluenceScore: number;
}

function decideEntry(
  candles: ReadonlyArray<NormalizedCandle>,
  asOfIndex: number,
  config: BacktestConfig,
): EntryDecision | null {
  if (candles.length < 50) return null;

  const analysis = runRealSMCEngine(candles, asOfIndex);

  if (!analysis.confluence.eligible) return null;

  const reg = analysis.regime.regime;
  if (reg !== 'TREND_UP' && reg !== 'TREND_DOWN') return null;

  const atr = analysis.atrCurrent;
  if (atr === null || atr <= 0) return null;

  const currentPrice = analysis.currentPrice;
  const direction: TradeDirection = reg === 'TREND_UP' ? 'LONG' : 'SHORT';

  const slDistance = config.slAtrMultiplier * atr;
  if (slDistance <= 0) return null;

  const stopLoss = direction === 'LONG'
    ? currentPrice - slDistance
    : currentPrice + slDistance;

  const tp1 = direction === 'LONG'
    ? currentPrice + config.tp1RMultiple * slDistance
    : currentPrice - config.tp1RMultiple * slDistance;

  const tp2 = direction === 'LONG'
    ? currentPrice + config.tp2RMultiple * slDistance
    : currentPrice - config.tp2RMultiple * slDistance;

  const grossRR = Math.abs(tp1 - currentPrice) / slDistance;
  if (grossRR < config.minimumRR) return null;

  return {
    direction,
    entryPrice: currentPrice,
    stopLoss,
    takeProfit1: tp1,
    takeProfit2: tp2,
    confluenceScore: analysis.confluence.score,
  };
}

export function runBacktest(
  input: BacktestInput,
): BacktestResult {
  const config = input.config ?? DEFAULT_BACKTEST_CONFIG;
  const candles = input.candles;

  if (candles.length < 200) {
    return {
      ok: false,
      trades: [],
      metrics: null,
      equityCurve: [],
      periodStart: candles[0]?.time ?? 0,
      periodEnd: candles[candles.length - 1]?.time ?? 0,
      reason: {
        code: 'INSUFFICIENT_CANDLES',
        shortAr: 'عدد الشموع غير كافٍ',
        detailsAr: `Got ${candles.length}, need at least 200.`,
        howToFix: ['قم بتحميل بيانات تاريخية أطول'],
      },
    };
  }

  const trades: BacktestTrade[] = [];
  const equityCurve: number[] = [config.initialEquity];
  let equity = config.initialEquity;

  const warmup = Math.max(config.atrPeriod * 3, 100);
  let i = warmup;
  let tradeCounter = 0;

  while (i < candles.length - 1) {
    const visible = candles.slice(0, i + 1);
    const decision = decideEntry(visible, i, config);

    if (decision === null) {
      i++;
      continue;
    }

    const riskUsd = equity * config.riskPercent;
    const riskDistance = Math.abs(decision.entryPrice - decision.stopLoss);
    if (riskDistance <= 0) {
      i++;
      continue;
    }
    const size = riskUsd / riskDistance;

    const futureCandles = candles.slice(i + 1);
    tradeCounter++;
    const trade = simulateTrade({
      id: `trade_${tradeCounter}`,
      direction: decision.direction,
      entryTime: candles[i].time,
      entryPrice: decision.entryPrice,
      stopLoss: decision.stopLoss,
      takeProfit1: decision.takeProfit1,
      takeProfit2: decision.takeProfit2,
      size,
      spreadUsd: config.spreadUsd,
      commissionUsd: config.commissionUsd,
      maxHoldBars: config.maxHoldBars,
      futureCandles,
      regime: null,
      confluenceScore: decision.confluenceScore,
    });

    trades.push(trade);
    equity += trade.netPnl;
    equityCurve.push(equity);

    const exitIndex = candles.findIndex((c) => c.time === trade.exitTime);
    if (exitIndex > i) {
      i = exitIndex + 1;
    } else {
      i++;
    }
  }

  const metrics = trades.length > 0
    ? computeMetrics({
        trades,
        initialEquity: config.initialEquity,
        finalEquity: equity,
      })
    : null;

  return {
    ok: true,
    trades,
    metrics,
    equityCurve,
    periodStart: candles[0].time,
    periodEnd: candles[candles.length - 1].time,
  };
}
