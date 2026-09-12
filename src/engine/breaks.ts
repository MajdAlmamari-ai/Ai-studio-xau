/**
 * Break of Structure (BOS) / Change of Character (CHoCH) Detection.
 *
 * A break is detected when a candle's CLOSE crosses a confirmed
 * swing level by at least `minStrengthAtr` (in ATR units).
 *
 * Classification:
 *   - Prior regime UP  + break up   → BOS_UP
 *   - Prior regime UP  + break down → CHoCH_DOWN
 *   - Prior regime DOWN+ break up   → CHoCH_UP
 *   - Prior regime DOWN+ break down → BOS_DOWN
 *   - Prior regime RANGE/UNKNOWN → classified as CHoCH (transition)
 *
 * Anti-lookahead:
 *   - Only uses swings confirmed as of the break candle.
 *   - Only uses candles up to the break candle.
 */

import {
  AtrArray,
  BreakDetectionConfig,
  ConfirmedSwing,
  DEFAULT_BREAK_CONFIG,
  NormalizedCandle,
  PriorRegime,
  StructureBreak,
} from './types';
import { getSwingsAsOf } from './swings';

/**
 * Compute the prior regime as of index `i`, based on swings confirmed
 * BEFORE index i.
 */
function computePriorRegime(
  swings: ReadonlyArray<ConfirmedSwing>,
  i: number,
): PriorRegime {
  const visible = getSwingsAsOf(swings, i - 1);
  if (visible.length < 2) return 'UNKNOWN';

  // Take the last 4 swings and check the trend pattern
  const recent = visible.slice(-4);
  const highs = recent.filter((s) => s.type === 'HIGH');
  const lows = recent.filter((s) => s.type === 'LOW');

  if (highs.length < 2 || lows.length < 2) return 'UNKNOWN';

  const lastHigh = highs[highs.length - 1].price;
  const prevHigh = highs[highs.length - 2].price;
  const lastLow = lows[lows.length - 1].price;
  const prevLow = lows[lows.length - 2].price;

  const higherHighs = lastHigh > prevHigh;
  const higherLows = lastLow > prevLow;
  const lowerHighs = lastHigh < prevHigh;
  const lowerLows = lastLow < prevLow;

  if (higherHighs && higherLows) return 'UPTREND';
  if (lowerHighs && lowerLows) return 'DOWNTREND';
  return 'RANGE';
}

/**
 * Detect structure breaks.
 */
export function detectBreaks(
  candles: ReadonlyArray<NormalizedCandle>,
  swings: ReadonlyArray<ConfirmedSwing>,
  atr: AtrArray,
  config: BreakDetectionConfig = DEFAULT_BREAK_CONFIG,
): StructureBreak[] {
  if (config.leftBars < 1 || config.rightBars < 1) {
    throw new Error('leftBars and rightBars must be >= 1');
  }
  if (config.minStrengthAtr < 0) {
    throw new Error('minStrengthAtr must be >= 0');
  }

  const breaks: StructureBreak[] = [];
  const n = candles.length;

  // We can only evaluate breaks after the warmup period
  // Start at the first index where ATR is available + leftBars
  let startIndex = 0;
  for (let i = 0; i < atr.length; i++) {
    if (atr[i] !== null) {
      startIndex = i + 1;
      break;
    }
  }

  for (let i = startIndex; i < n; i++) {
    const currentAtr = atr[i];
    if (currentAtr === null || currentAtr <= 0) continue;

    const currentClose = candles[i].close;
    const visibleSwings = getSwingsAsOf(swings, i - 1);
    if (visibleSwings.length === 0) continue;

    // Find the most recent unbroken swing high and low
    const swingsHigh = visibleSwings.filter((s) => s.type === 'HIGH');
    const swingsLow = visibleSwings.filter((s) => s.type === 'LOW');

    const lastSwingHigh = swingsHigh.length > 0
      ? swingsHigh[swingsHigh.length - 1]
      : null;
    const lastSwingLow = swingsLow.length > 0
      ? swingsLow[swingsLow.length - 1]
      : null;

    const priorRegime = computePriorRegime(swings, i);

    // Check BOS/CHoCH UP: close breaks above last swing high
    if (lastSwingHigh !== null && currentClose > lastSwingHigh.price) {
      const strength = (currentClose - lastSwingHigh.price) / currentAtr;
      if (strength >= config.minStrengthAtr) {
        let type: StructureBreak['type'];
        if (priorRegime === 'UPTREND') {
          type = 'BOS_UP';
        } else if (priorRegime === 'DOWNTREND') {
          type = 'CHOCH_UP';
        } else {
          type = 'CHOCH_UP';
        }
        breaks.push({
          type,
          level: lastSwingHigh.price,
          swingIndex: lastSwingHigh.index,
          breakIndex: i,
          breakTime: candles[i].time,
          strengthAtr: strength,
          priorRegime,
          confirmedAtIndex: i,
        });
      }
    }

    // Check BOS/CHoCH DOWN: close breaks below last swing low
    if (lastSwingLow !== null && currentClose < lastSwingLow.price) {
      const strength = (lastSwingLow.price - currentClose) / currentAtr;
      if (strength >= config.minStrengthAtr) {
        let type: StructureBreak['type'];
        if (priorRegime === 'DOWNTREND') {
          type = 'BOS_DOWN';
        } else if (priorRegime === 'UPTREND') {
          type = 'CHOCH_DOWN';
        } else {
          type = 'CHOCH_DOWN';
        }
        breaks.push({
          type,
          level: lastSwingLow.price,
          swingIndex: lastSwingLow.index,
          breakIndex: i,
          breakTime: candles[i].time,
          strengthAtr: strength,
          priorRegime,
          confirmedAtIndex: i,
        });
      }
    }
  }

  return breaks;
}

/**
 * Filter breaks confirmed as of a decision index.
 */
export function getBreaksAsOf(
  breaks: ReadonlyArray<StructureBreak>,
  asOfIndex: number,
): StructureBreak[] {
  return breaks.filter((b) => b.confirmedAtIndex <= asOfIndex);
}

/**
 * Get the most recent break of any type.
 */
export function getLatestBreak(
  breaks: ReadonlyArray<StructureBreak>,
): StructureBreak | null {
  if (breaks.length === 0) return null;
  return breaks[breaks.length - 1];
}
