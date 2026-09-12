/**
 * Confirmed Swing Detection.
 *
 * A swing high at index i is confirmed if:
 *   candles[i].high > candles[j].high for all j in [i-left, i-1]
 *   AND
 *   candles[i].high > candles[j].high for all j in [i+1, i+right]
 *
 * Symmetric for swing low.
 *
 * Rules:
 *   - A swing is only emitted if i + rightBars < candles.length.
 *   - confirmedAtIndex = index + rightBars.
 *   - Anti-lookahead: consumers use getSwingsAsOf(swings, t).
 *   - Deterministic. No Math.random.
 */

import {
  ConfirmedSwing,
  NormalizedCandle,
  SwingDetectionConfig,
  SwingType,
} from './types';

function isSwingHigh(
  candles: ReadonlyArray<NormalizedCandle>,
  i: number,
  left: number,
  right: number,
): boolean {
  const pivot = candles[i].high;
  for (let k = 1; k <= left; k++) {
    if (candles[i - k].high >= pivot) return false;
  }
  for (let k = 1; k <= right; k++) {
    if (candles[i + k].high >= pivot) return false;
  }
  return true;
}

function isSwingLow(
  candles: ReadonlyArray<NormalizedCandle>,
  i: number,
  left: number,
  right: number,
): boolean {
  const pivot = candles[i].low;
  for (let k = 1; k <= left; k++) {
    if (candles[i - k].low <= pivot) return false;
  }
  for (let k = 1; k <= right; k++) {
    if (candles[i + k].low <= pivot) return false;
  }
  return true;
}

export function detectSwings(
  candles: ReadonlyArray<NormalizedCandle>,
  config: SwingDetectionConfig,
): ConfirmedSwing[] {
  const { leftBars, rightBars } = config;

  if (leftBars < 1 || rightBars < 1) {
    throw new Error(
      `leftBars and rightBars must be >= 1, got left=${leftBars}, right=${rightBars}`,
    );
  }

  const n = candles.length;
  const swings: ConfirmedSwing[] = [];

  const start = leftBars;
  const end = n - rightBars - 1;

  for (let i = start; i <= end; i++) {
    if (isSwingHigh(candles, i, leftBars, rightBars)) {
      swings.push({
        type: 'HIGH',
        index: i,
        time: candles[i].time,
        price: candles[i].high,
        confirmedAtIndex: i + rightBars,
      });
    }
    if (isSwingLow(candles, i, leftBars, rightBars)) {
      swings.push({
        type: 'LOW',
        index: i,
        time: candles[i].time,
        price: candles[i].low,
        confirmedAtIndex: i + rightBars,
      });
    }
  }

  return swings;
}

export function getSwingsAsOf(
  swings: ReadonlyArray<ConfirmedSwing>,
  asOfIndex: number,
): ConfirmedSwing[] {
  return swings.filter((s) => s.confirmedAtIndex <= asOfIndex);
}

export function getLatestSwing(
  swings: ReadonlyArray<ConfirmedSwing>,
  type: SwingType,
): ConfirmedSwing | null {
  for (let i = swings.length - 1; i >= 0; i--) {
    if (swings[i].type === type) return swings[i];
  }
  return null;
}

export function getRecentSwings(
  swings: ReadonlyArray<ConfirmedSwing>,
  type: SwingType,
  count: number,
): ConfirmedSwing[] {
  const filtered = swings.filter((s) => s.type === type);
  if (filtered.length <= count) return filtered;
  return filtered.slice(-count);
}
