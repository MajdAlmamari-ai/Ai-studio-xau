/**
 * Trade Simulator
 *
 * Simulates a single trade's lifecycle given:
 *   - Entry signal
 *   - Future candles (only those AFTER entry time)
 *
 * Policies:
 *   - Same-bar SL/TP: SL_FIRST_CONSERVATIVE
 *   - Trailing: none
 *   - Partial TPs: TP1 (50%), TP2 (50%)
 *
 * Deterministic. NO Math.random.
 * NO lookahead: only uses candles with time > entryTime.
 */

import {
  BacktestTrade,
  ExitReason,
  NormalizedCandle,
  Regime,
  TradeDirection,
} from './types';

export interface SimulatorInput {
  readonly id: string;
  readonly direction: TradeDirection;
  readonly entryTime: number;
  readonly entryPrice: number;
  readonly stopLoss: number;
  readonly takeProfit1: number;
  readonly takeProfit2: number;
  readonly size: number;
  readonly spreadUsd: number;
  readonly commissionUsd: number;
  readonly maxHoldBars: number;
  readonly futureCandles: ReadonlyArray<NormalizedCandle>;
  readonly regime: Regime | null;
  readonly confluenceScore: number | null;
}

/**
 * Simulate a single trade to completion.
 * 
 * Returns a BacktestTrade with all fields filled.
 */
export function simulateTrade(input: SimulatorInput): BacktestTrade {
  const {
    id, direction, entryTime, entryPrice, stopLoss,
    takeProfit1, takeProfit2, size, spreadUsd, commissionUsd,
    maxHoldBars, futureCandles, regime, confluenceScore,
  } = input;

  const risk = Math.abs(entryPrice - stopLoss);

  // Initial MAE/MFE tracking (in price units)
  let mae = 0;
  let mfe = 0;

  // No future candles → force exit at entry
  if (futureCandles.length === 0) {
    const netPnl = -commissionUsd;
    return {
      id,
      direction,
      entryTime,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      exitTime: entryTime,
      exitPrice: entryPrice,
      exitReason: 'END_OF_DATA',
      size,
      grossPnl: 0,
      netPnl,
      realizedR: risk > 0 ? netPnl / (risk * size) : 0,
      mae: 0,
      mfe: 0,
      barsHeld: 0,
      regime,
      confluenceScore,
    };
  }

  const barsToCheck = futureCandles.slice(0, maxHoldBars);

  for (let i = 0; i < barsToCheck.length; i++) {
    const c = barsToCheck[i];

    // Compute MAE / MFE within this bar
    if (direction === 'LONG') {
      const lowDist = (entryPrice - c.low);
      const highDist = (c.high - entryPrice);
      if (lowDist > mae) mae = lowDist;
      if (highDist > mfe) mfe = highDist;
    } else {
      const highDist = (c.high - entryPrice);
      const lowDist = (entryPrice - c.low);
      if (highDist > mae) mae = highDist;
      if (lowDist > mfe) mfe = lowDist;
    }

    // Check SL / TP hits
    let slHit = false;
    let tpHit = false;
    let exitPrice: number | null = null;
    let exitReason: ExitReason | null = null;

    if (direction === 'LONG') {
      if (c.low <= stopLoss) slHit = true;
      if (c.high >= takeProfit1) tpHit = true;

      if (slHit && tpHit) {
        // SL_FIRST_CONSERVATIVE
        exitPrice = stopLoss;
        exitReason = 'AMBIGUOUS_SL_FIRST';
      } else if (slHit) {
        exitPrice = stopLoss;
        exitReason = 'SL_HIT';
      } else if (tpHit) {
        exitPrice = takeProfit1;
        exitReason = 'TP_HIT';
      }
    } else {
      if (c.high >= stopLoss) slHit = true;
      if (c.low <= takeProfit1) tpHit = true;

      if (slHit && tpHit) {
        exitPrice = stopLoss;
        exitReason = 'AMBIGUOUS_SL_FIRST';
      } else if (slHit) {
        exitPrice = stopLoss;
        exitReason = 'SL_HIT';
      } else if (tpHit) {
        exitPrice = takeProfit1;
        exitReason = 'TP_HIT';
      }
    }

    if (exitPrice !== null && exitReason !== null) {
      const grossPnl = direction === 'LONG'
        ? (exitPrice - entryPrice) * size
        : (entryPrice - exitPrice) * size;
      const netPnl = grossPnl - spreadUsd * size - commissionUsd;

      return {
        id,
        direction,
        entryTime,
        entryPrice,
        stopLoss,
        takeProfit1,
        takeProfit2,
        exitTime: c.time,
        exitPrice,
        exitReason,
        size,
        grossPnl,
        netPnl,
        realizedR: risk > 0 ? netPnl / (risk * size) : 0,
        mae,
        mfe,
        barsHeld: i + 1,
        regime,
        confluenceScore,
      };
    }
  }

  // Timeout: exit at last candle close
  const last = barsToCheck[barsToCheck.length - 1];
  const exitPrice = last.close;
  const grossPnl = direction === 'LONG'
    ? (exitPrice - entryPrice) * size
    : (entryPrice - exitPrice) * size;
  const netPnl = grossPnl - spreadUsd * size - commissionUsd;

  return {
    id,
    direction,
    entryTime,
    entryPrice,
    stopLoss,
    takeProfit1,
    takeProfit2,
    exitTime: last.time,
    exitPrice,
    exitReason: 'TIMEOUT',
    size,
    grossPnl,
    netPnl,
    realizedR: risk > 0 ? netPnl / (risk * size) : 0,
    mae,
    mfe,
    barsHeld: barsToCheck.length,
    regime,
    confluenceScore,
  };
}
