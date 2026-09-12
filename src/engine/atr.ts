/**
 * Wilder ATR (Average True Range) Calculator.
 *
 * Methodology (Wilder, 1978):
 *   1. True Range:
 *        TR[i] = max(
 *          high[i] - low[i],
 *          |high[i] - close[i-1]|,
 *          |low[i]  - close[i-1]|
 *        )
 *        TR[0] = high[0] - low[0]
 *   2. First ATR (at index period-1) = simple average of first `period` TR.
 *   3. Subsequent ATR via Wilder smoothing:
 *        ATR[i] = (ATR[i-1] * (period - 1) + TR[i]) / period
 *
 * Rules:
 *   - Returns null for indices < period - 1 (warmup).
 *   - Never returns 0 or NaN after warmup.
 *   - Deterministic. No Math.random.
 *   - No hardcoded ATR values.
 */

import {
  AtrArray,
  AtrResult,
  ATR_PERIOD,
  NormalizedCandle,
  SpringCoilMeta,
} from './types';

/**
 * Calculate True Range for a single candle.
 */
export function calculateTrueRange(
  current: NormalizedCandle,
  previous: NormalizedCandle | null,
): number {
  const highLow = current.high - current.low;
  if (previous === null) {
    return highLow;
  }
  const highClose = Math.abs(current.high - previous.close);
  const lowClose = Math.abs(current.low - previous.close);
  return Math.max(highLow, highClose, lowClose);
}

/**
 * Calculate Wilder ATR for an array of candles (ascending order).
 */
export function calculateATR(
  candles: ReadonlyArray<NormalizedCandle>,
  period: number = ATR_PERIOD,
): AtrArray {
  if (period < 1) {
    throw new Error(`ATR period must be >= 1, got ${period}`);
  }
  if (candles.length === 0) {
    return [];
  }

  const n = candles.length;
  const result: (number | null)[] = new Array(n).fill(null);

  const tr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = i === 0 ? null : candles[i - 1];
    tr[i] = calculateTrueRange(candles[i], prev);
  }

  if (n < period) {
    return result;
  }

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  const initialATR = sum / period;
  result[period - 1] = initialATR;

  let prevATR = initialATR;
  for (let i = period; i < n; i++) {
    const currentATR = (prevATR * (period - 1) + tr[i]) / period;
    result[i] = currentATR;
    prevATR = currentATR;
  }

  return result;
}

/**
 * Get ATR at a specific index.
 */
export function getATR(atr: AtrArray, index: number): number | null {
  if (index < 0 || index >= atr.length) {
    return null;
  }
  return atr[index];
}

/**
 * Get the latest ATR value.
 */
export function getLatestATR(atr: AtrArray): number | null {
  if (atr.length === 0) return null;
  return atr[atr.length - 1];
}

/**
 * Compute Spring Coil metadata from an ATR array.
 *
 * @param atr - ATR array
 * @param lookback - Number of recent candles to search for lowest ATR (default 20)
 * @param compressionThreshold - Ratio threshold (default 1.15)
 */
export function computeSpringCoilMeta(
  atr: AtrArray,
  lookback: number = 20,
  compressionThreshold: number = 1.15,
): SpringCoilMeta {
  if (atr.length === 0) {
    return {
      currentATR: null,
      lowestATR20: null,
      springCoilRatio: null,
      isSpringCoilActive: false,
    };
  }

  const currentATR = atr[atr.length - 1] ?? null;

  // Collect non-null ATR values from the last `lookback` candles
  const start = Math.max(0, atr.length - lookback);
  const recentValues: number[] = [];
  for (let i = start; i < atr.length; i++) {
    const v = atr[i];
    if (v !== null && Number.isFinite(v) && v > 0) {
      recentValues.push(v);
    }
  }

  if (recentValues.length === 0 || currentATR === null) {
    return {
      currentATR,
      lowestATR20: null,
      springCoilRatio: null,
      isSpringCoilActive: false,
    };
  }

  const lowestATR20 = Math.min(...recentValues);

  if (lowestATR20 <= 0) {
    return {
      currentATR,
      lowestATR20,
      springCoilRatio: null,
      isSpringCoilActive: false,
    };
  }

  const springCoilRatio = currentATR / lowestATR20;
  const isSpringCoilActive = springCoilRatio <= compressionThreshold;

  return {
    currentATR,
    lowestATR20,
    springCoilRatio,
    isSpringCoilActive,
  };
}

/**
 * Full ATR computation including Spring Coil metadata.
 */
export function calculateATRWithSpringCoil(
  candles: ReadonlyArray<NormalizedCandle>,
  period: number = ATR_PERIOD,
  lookback: number = 20,
): AtrResult {
  const atr = calculateATR(candles, period);
  const springCoil = computeSpringCoilMeta(atr, lookback);
  return { atr, springCoil };
}
