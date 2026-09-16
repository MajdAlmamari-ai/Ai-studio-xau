/**
 * Backtest Types
 *
 * All backtest logic must be deterministic.
 * NO Math.random.
 * NO lookahead.
 *
 * The backtest engine simulates decisions using ONLY data
 * available up to decision time (as-of t).
 */

import type { NormalizedCandle, Regime } from '../types';

export type { NormalizedCandle, Regime };

export type TradeDirection = 'LONG' | 'SHORT';

export type ExitReason =
  | 'TP_HIT'
  | 'SL_HIT'
  | 'AMBIGUOUS_SL_FIRST'
  | 'TIMEOUT'
  | 'END_OF_DATA';

export interface BacktestConfig {
  /** Starting equity in USD. */
  readonly initialEquity: number;

  /** Risk per trade (0.005 = 0.5%). */
  readonly riskPercent: number;

  /** Minimum net R:R to accept a trade. */
  readonly minimumRR: number;

  /** ATR period used for SL/TP. */
  readonly atrPeriod: number;

  /** SL buffer multiplier on ATR. */
  readonly slAtrMultiplier: number;

  /** TP1 distance in R multiples. */
  readonly tp1RMultiple: number;

  /** TP2 distance in R multiples. */
  readonly tp2RMultiple: number;

  /** Maximum bars to hold a trade. */
  readonly maxHoldBars: number;

  /** Estimated spread in USD. */
  readonly spreadUsd: number;

  /** Estimated commission per trade in USD. */
  readonly commissionUsd: number;

  /** Same-bar SL/TP policy. */
  readonly sameBarPolicy: 'SL_FIRST_CONSERVATIVE' | 'TP_FIRST_OPTIMISTIC';

  /** Walk-forward config. */
  readonly walkForward: WalkForwardConfig;
}

export interface WalkForwardConfig {
  readonly trainBars: number;
  readonly validationBars: number;
  readonly testBars: number;
  readonly stepBars: number;
  readonly mode: 'ROLLING' | 'EXPANDING';
  readonly minTradesPerFold: number;
  readonly holdoutBars: number;
}

export const DEFAULT_WALK_FORWARD: WalkForwardConfig = {
  trainBars: 5000,
  validationBars: 1000,
  testBars: 1000,
  stepBars: 500,
  mode: 'ROLLING',
  minTradesPerFold: 30,
  holdoutBars: 2000,
};

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  initialEquity: 10000,
  riskPercent: 0.005,
  minimumRR: 2.0,
  atrPeriod: 14,
  slAtrMultiplier: 1.5,
  tp1RMultiple: 2.0,
  tp2RMultiple: 3.5,
  maxHoldBars: 96,
  spreadUsd: 0.3,
  commissionUsd: 0.05,
  sameBarPolicy: 'SL_FIRST_CONSERVATIVE',
  walkForward: DEFAULT_WALK_FORWARD,
};

export interface BacktestTrade {
  readonly id: string;
  readonly direction: TradeDirection;
  readonly entryTime: number;
  readonly entryPrice: number;
  readonly stopLoss: number;
  readonly takeProfit1: number;
  readonly takeProfit2: number;
  readonly exitTime: number | null;
  readonly exitPrice: number | null;
  readonly exitReason: ExitReason | null;
  readonly size: number;
  readonly grossPnl: number;
  readonly netPnl: number;
  readonly realizedR: number;
  readonly mae: number;
  readonly mfe: number;
  readonly barsHeld: number;
  readonly regime: Regime | null;
  readonly confluenceScore: number | null;
}

export interface BacktestMetrics {
  readonly totalTrades: number;
  readonly winningTrades: number;
  readonly losingTrades: number;
  readonly winRate: number;
  readonly expectancyR: number;
  readonly averageR: number;
  readonly medianR: number;
  readonly profitFactor: number;
  readonly grossProfit: number;
  readonly grossLoss: number;
  readonly netProfit: number;
  readonly maxDrawdownPct: number;
  readonly finalEquity: number;
  readonly sharpeRatio: number | null;
  readonly averageBarsHeld: number;
  readonly maxConsecutiveLosses: number;
}

export interface BacktestResult {
  readonly ok: boolean;
  readonly trades: readonly BacktestTrade[];
  readonly metrics: BacktestMetrics | null;
  readonly equityCurve: readonly number[];
  readonly periodStart: number;
  readonly periodEnd: number;
  readonly reason?: {
    code: string;
    shortAr: string;
    detailsAr: string;
    howToFix: string[];
  };
}
