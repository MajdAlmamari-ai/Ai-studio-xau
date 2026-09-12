/**
 * Market Regime Classification.
 *
 * Determines the current market regime from ATR, swings, and breaks.
 *
 * Anti-lookahead:
 *   - All inputs must be slices up to asOfIndex.
 *   - The caller is responsible for slicing.
 *
 * Deterministic. No Math.random.
 */

import {
  AtrArray,
  ConfirmedSwing,
  NormalizedCandle,
  Regime,
  RegimeConfig,
  RegimeContext,
  StructureBreak,
  DEFAULT_REGIME_CONFIG,
} from './types';

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function computeATRMedian(
  atr: AtrArray,
  asOfIndex: number,
  lookback: number,
): number | null {
  const values: number[] = [];
  const start = Math.max(0, asOfIndex - lookback + 1);
  for (let i = start; i <= asOfIndex; i++) {
    const v = atr[i];
    if (v !== null && Number.isFinite(v) && v > 0) {
      values.push(v);
    }
  }
  return median(values);
}

function hasHigherHighsAndLows(
  swings: ReadonlyArray<ConfirmedSwing>,
  asOfIndex: number,
  count: number,
): boolean {
  const visible = swings.filter((s) => s.confirmedAtIndex <= asOfIndex);
  const highs = visible.filter((s) => s.type === 'HIGH').slice(-count);
  const lows = visible.filter((s) => s.type === 'LOW').slice(-count);

  if (highs.length < 2 || lows.length < 2) return false;

  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price <= highs[i - 1].price) return false;
  }
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price <= lows[i - 1].price) return false;
  }
  return true;
}

function hasLowerHighsAndLows(
  swings: ReadonlyArray<ConfirmedSwing>,
  asOfIndex: number,
  count: number,
): boolean {
  const visible = swings.filter((s) => s.confirmedAtIndex <= asOfIndex);
  const highs = visible.filter((s) => s.type === 'HIGH').slice(-count);
  const lows = visible.filter((s) => s.type === 'LOW').slice(-count);

  if (highs.length < 2 || lows.length < 2) return false;

  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price >= highs[i - 1].price) return false;
  }
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price >= lows[i - 1].price) return false;
  }
  return true;
}

function hasRecentBreak(
  breaks: ReadonlyArray<StructureBreak>,
  asOfIndex: number,
  type: 'BOS_UP' | 'BOS_DOWN',
): boolean {
  const visible = breaks.filter((b) => b.confirmedAtIndex <= asOfIndex);
  if (visible.length === 0) return false;
  return visible[visible.length - 1].type === type;
}

export function classifyRegime(
  candles: ReadonlyArray<NormalizedCandle>,
  atr: AtrArray,
  swings: ReadonlyArray<ConfirmedSwing>,
  breaks: ReadonlyArray<StructureBreak>,
  asOfIndex: number,
  config: RegimeConfig = DEFAULT_REGIME_CONFIG,
): RegimeContext {
  if (asOfIndex < 0 || asOfIndex >= candles.length) {
    throw new Error(`asOfIndex out of range: ${asOfIndex}`);
  }

  const barsUsed = asOfIndex + 1;

  if (barsUsed < config.minBars) {
    return {
      regime: 'UNKNOWN',
      classifiedAtIndex: asOfIndex,
      atrCurrent: null,
      atrMedian: null,
      atrRatio: null,
      barsUsed,
      reasonCodes: ['INSUFFICIENT_BARS'],
    };
  }

  const atrCurrent = atr[asOfIndex];
  if (atrCurrent === null || atrCurrent <= 0) {
    return {
      regime: 'UNKNOWN',
      classifiedAtIndex: asOfIndex,
      atrCurrent: null,
      atrMedian: null,
      atrRatio: null,
      barsUsed,
      reasonCodes: ['ATR_NOT_READY'],
    };
  }

  const atrMedian = computeATRMedian(atr, asOfIndex, config.medianLookback);
  const atrRatio = atrMedian !== null && atrMedian > 0 ? atrCurrent / atrMedian : null;

  const reasonCodes: string[] = [];

  if (atrRatio !== null) {
    if (atrRatio >= config.highVolMultiplier) {
      reasonCodes.push('HIGH_VOLATILITY');
      return {
        regime: 'HIGH_VOLATILITY',
        classifiedAtIndex: asOfIndex,
        atrCurrent,
        atrMedian,
        atrRatio,
        barsUsed,
        reasonCodes,
      };
    }
    if (atrRatio <= config.lowVolMultiplier) {
      reasonCodes.push('LOW_LIQUIDITY');
      return {
        regime: 'LOW_LIQUIDITY',
        classifiedAtIndex: asOfIndex,
        atrCurrent,
        atrMedian,
        atrRatio,
        barsUsed,
        reasonCodes,
      };
    }
  }

  const hhHl = hasHigherHighsAndLows(swings, asOfIndex, config.trendSwingLookback);
  const lhLl = hasLowerHighsAndLows(swings, asOfIndex, config.trendSwingLookback);
  const recentBosUp = hasRecentBreak(breaks, asOfIndex, 'BOS_UP');
  const recentBosDown = hasRecentBreak(breaks, asOfIndex, 'BOS_DOWN');

  if (hhHl && recentBosUp) {
    reasonCodes.push('HH_HL', 'BOS_UP');
    return {
      regime: 'TREND_UP',
      classifiedAtIndex: asOfIndex,
      atrCurrent,
      atrMedian,
      atrRatio,
      barsUsed,
      reasonCodes,
    };
  }

  if (lhLl && recentBosDown) {
    reasonCodes.push('LH_LL', 'BOS_DOWN');
    return {
      regime: 'TREND_DOWN',
      classifiedAtIndex: asOfIndex,
      atrCurrent,
      atrMedian,
      atrRatio,
      barsUsed,
      reasonCodes,
    };
  }

  const visibleSwings = swings.filter((s) => s.confirmedAtIndex <= asOfIndex);
  if (visibleSwings.length >= 4) {
    reasonCodes.push('NO_CLEAR_TREND');
    return {
      regime: 'RANGE',
      classifiedAtIndex: asOfIndex,
      atrCurrent,
      atrMedian,
      atrRatio,
      barsUsed,
      reasonCodes,
    };
  }

  reasonCodes.push('NORMAL');
  return {
    regime: 'NORMAL_VOLATILITY',
    classifiedAtIndex: asOfIndex,
    atrCurrent,
    atrMedian,
    atrRatio,
    barsUsed,
    reasonCodes,
  };
}

export function classifyLatestRegime(
  candles: ReadonlyArray<NormalizedCandle>,
  atr: AtrArray,
  swings: ReadonlyArray<ConfirmedSwing>,
  breaks: ReadonlyArray<StructureBreak>,
  config: RegimeConfig = DEFAULT_REGIME_CONFIG,
): RegimeContext {
  if (candles.length === 0) {
    throw new Error('Cannot classify regime: empty candles');
  }
  return classifyRegime(candles, atr, swings, breaks, candles.length - 1, config);
}
