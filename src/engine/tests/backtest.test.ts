import { describe, it, expect } from 'vitest';
import { runBacktest } from '../backtest/engine';
import { computeMetrics } from '../backtest/metrics';
import { simulateTrade } from '../backtest/simulator';
import {
  BacktestConfig,
  DEFAULT_BACKTEST_CONFIG,
  NormalizedCandle,
  TradeDirection,
} from '../backtest/types';

function makeCandle(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
): NormalizedCandle {
  return {
    time: 1_700_000_000 + index * 900,
    timeFormatted: '',
    open,
    high,
    low,
    close,
    volume: 100,
  };
}

function makeTrendSeries(length: number, up = true): NormalizedCandle[] {
  return Array.from({ length }, (_, i) => {
    const base = up ? 100 + i * 0.5 : 200 - i * 0.5;
    return makeCandle(i, base, base + 1, base - 1, base + 0.3);
  });
}

describe('Backtest — simulator', () => {
  it('SL hit → exitReason SL_HIT', () => {
    const trade = simulateTrade({
      id: 't1',
      direction: 'LONG' as TradeDirection,
      entryTime: 1_700_000_000,
      entryPrice: 100,
      stopLoss: 98,
      takeProfit1: 105,
      takeProfit2: 110,
      size: 1,
      spreadUsd: 0,
      commissionUsd: 0,
      maxHoldBars: 10,
      futureCandles: [
        makeCandle(1, 100, 101, 97, 98),
      ],
      regime: null,
      confluenceScore: null,
    });
    expect(trade.exitReason).toBe('SL_HIT');
    expect(trade.exitPrice).toBe(98);
  });

  it('TP hit → exitReason TP_HIT', () => {
    const trade = simulateTrade({
      id: 't2',
      direction: 'LONG' as TradeDirection,
      entryTime: 1_700_000_000,
      entryPrice: 100,
      stopLoss: 98,
      takeProfit1: 105,
      takeProfit2: 110,
      size: 1,
      spreadUsd: 0,
      commissionUsd: 0,
      maxHoldBars: 10,
      futureCandles: [
        makeCandle(1, 100, 106, 99, 105),
      ],
      regime: null,
      confluenceScore: null,
    });
    expect(trade.exitReason).toBe('TP_HIT');
    expect(trade.exitPrice).toBe(105);
  });

  it('same-bar SL+TP → SL_FIRST_CONSERVATIVE', () => {
    const trade = simulateTrade({
      id: 't3',
      direction: 'LONG' as TradeDirection,
      entryTime: 1_700_000_000,
      entryPrice: 100,
      stopLoss: 98,
      takeProfit1: 105,
      takeProfit2: 110,
      size: 1,
      spreadUsd: 0,
      commissionUsd: 0,
      maxHoldBars: 10,
      futureCandles: [
        makeCandle(1, 100, 106, 97, 100),
      ],
      regime: null,
      confluenceScore: null,
    });
    expect(trade.exitReason).toBe('AMBIGUOUS_SL_FIRST');
    expect(trade.exitPrice).toBe(98);
  });

  it('no SL/TP → TIMEOUT at last candle', () => {
    const trade = simulateTrade({
      id: 't4',
      direction: 'LONG' as TradeDirection,
      entryTime: 1_700_000_000,
      entryPrice: 100,
      stopLoss: 98,
      takeProfit1: 105,
      takeProfit2: 110,
      size: 1,
      spreadUsd: 0,
      commissionUsd: 0,
      maxHoldBars: 3,
      futureCandles: [
        makeCandle(1, 100, 101, 99, 100.5),
        makeCandle(2, 100.5, 101, 99, 100),
        makeCandle(3, 100, 101, 99, 100.2),
      ],
      regime: null,
      confluenceScore: null,
    });
    expect(trade.exitReason).toBe('TIMEOUT');
    expect(trade.barsHeld).toBe(3);
  });

  it('no future candles → END_OF_DATA', () => {
    const trade = simulateTrade({
      id: 't5',
      direction: 'LONG' as TradeDirection,
      entryTime: 1_700_000_000,
      entryPrice: 100,
      stopLoss: 98,
      takeProfit1: 105,
      takeProfit2: 110,
      size: 1,
      spreadUsd: 0,
      commissionUsd: 0,
      maxHoldBars: 10,
      futureCandles: [],
      regime: null,
      confluenceScore: null,
    });
    expect(trade.exitReason).toBe('END_OF_DATA');
  });

  it('deterministic', () => {
    const args = {
      id: 't6',
      direction: 'LONG' as TradeDirection,
      entryTime: 1_700_000_000,
      entryPrice: 100,
      stopLoss: 98,
      takeProfit1: 105,
      takeProfit2: 110,
      size: 1,
      spreadUsd: 0.3,
      commissionUsd: 0.05,
      maxHoldBars: 10,
      futureCandles: [makeCandle(1, 100, 106, 97, 105)],
      regime: null,
      confluenceScore: null,
    };
    const a = simulateTrade(args);
    const b = simulateTrade(args);
    expect(a).toEqual(b);
  });
});

describe('Backtest — metrics', () => {
  it('returns zeros for empty trades', () => {
    const metrics = computeMetrics({
      trades: [],
      initialEquity: 10000,
      finalEquity: 10000,
    });
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.winRate).toBe(0);
    expect(metrics.expectancyR).toBe(0);
  });

  it('computes winRate correctly', () => {
    const trades = [
      { netPnl: 100, realizedR: 2, barsHeld: 5 } as any,
      { netPnl: -50, realizedR: -1, barsHeld: 3 } as any,
      { netPnl: 200, realizedR: 4, barsHeld: 7 } as any,
      { netPnl: -50, realizedR: -1, barsHeld: 4 } as any,
    ];
    const metrics = computeMetrics({
      trades,
      initialEquity: 10000,
      finalEquity: 10200,
    });
    expect(metrics.totalTrades).toBe(4);
    expect(metrics.winningTrades).toBe(2);
    expect(metrics.losingTrades).toBe(2);
    expect(metrics.winRate).toBe(0.5);
  });

  it('computes profitFactor', () => {
    const trades = [
      { netPnl: 300, realizedR: 2, barsHeld: 5 } as any,
      { netPnl: -100, realizedR: -1, barsHeld: 3 } as any,
    ];
    const metrics = computeMetrics({
      trades,
      initialEquity: 10000,
      finalEquity: 10200,
    });
    expect(metrics.profitFactor).toBe(3);
    expect(metrics.grossProfit).toBe(300);
    expect(metrics.grossLoss).toBe(100);
  });

  it('profitFactor is Infinity when no losses', () => {
    const trades = [
      { netPnl: 100, realizedR: 2, barsHeld: 5 } as any,
    ];
    const metrics = computeMetrics({
      trades,
      initialEquity: 10000,
      finalEquity: 10100,
    });
    expect(metrics.profitFactor).toBe(Infinity);
  });

  it('computes max consecutive losses', () => {
    const trades = [
      { netPnl: -50, realizedR: -1, barsHeld: 3 } as any,
      { netPnl: -50, realizedR: -1, barsHeld: 3 } as any,
      { netPnl: -50, realizedR: -1, barsHeld: 3 } as any,
      { netPnl: 100, realizedR: 2, barsHeld: 5 } as any,
      { netPnl: -50, realizedR: -1, barsHeld: 3 } as any,
    ];
    const metrics = computeMetrics({
      trades,
      initialEquity: 10000,
      finalEquity: 9900,
    });
    expect(metrics.maxConsecutiveLosses).toBe(3);
  });

  it('deterministic', () => {
    const trades = [
      { netPnl: 100, realizedR: 2, barsHeld: 5 } as any,
      { netPnl: -50, realizedR: -1, barsHeld: 3 } as any,
    ];
    const a = computeMetrics({ trades, initialEquity: 10000, finalEquity: 10050 });
    const b = computeMetrics({ trades, initialEquity: 10000, finalEquity: 10050 });
    expect(a).toEqual(b);
  });
});

describe('Backtest — engine', () => {
  it('returns error for insufficient candles', () => {
    const result = runBacktest({
      candles: [makeCandle(0, 100, 101, 99, 100)],
    });
    expect(result.ok).toBe(false);
    expect(result.reason?.code).toBe('INSUFFICIENT_CANDLES');
  });

  it('runs on trending series without crash', () => {
    const candles = makeTrendSeries(300, true);
    const result = runBacktest({ candles });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.trades)).toBe(true);
    expect(Array.isArray(result.equityCurve)).toBe(true);
  });

  it('deterministic', () => {
    const candles = makeTrendSeries(300, true);
    const a = runBacktest({ candles });
    const b = runBacktest({ candles });
    expect(a.trades.length).toBe(b.trades.length);
    expect(a.equityCurve).toEqual(b.equityCurve);
  });

  it('NO lookahead — result unchanged when future added', () => {
    const base = makeTrendSeries(300, true);
    const withFuture = [
      ...base,
      ...makeTrendSeries(100, false).map((c, i) => ({
        ...c,
        time: base[base.length - 1].time + (i + 1) * 900,
      })),
    ];

    const a = runBacktest({ candles: base });
    const b = runBacktest({ candles: withFuture });

    // Trades that exited before the base end should match.
    const aTradesUpTo = a.trades.filter(
      (t) => t.exitTime !== null && t.exitTime <= base[base.length - 1].time,
    );
    const bTradesUpTo = b.trades.filter(
      (t) => t.exitTime !== null && t.exitTime <= base[base.length - 1].time,
    );

    expect(aTradesUpTo.length).toBe(bTradesUpTo.length);
    for (let i = 0; i < aTradesUpTo.length; i++) {
      expect(aTradesUpTo[i].entryTime).toBe(bTradesUpTo[i].entryTime);
      expect(aTradesUpTo[i].exitTime).toBe(bTradesUpTo[i].exitTime);
      expect(aTradesUpTo[i].exitReason).toBe(bTradesUpTo[i].exitReason);
    }
  });

  it('metrics computed when trades exist', () => {
    const candles = makeTrendSeries(500, true);
    const result = runBacktest({ candles });
    if (result.trades.length > 0) {
      expect(result.metrics).not.toBeNull();
      expect(result.metrics?.totalTrades).toBe(result.trades.length);
    }
  });
});
