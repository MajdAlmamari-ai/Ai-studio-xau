/**
 * Fair Value Gap (FVG) Detection and Lifecycle Management.
 *
 * FVG / Imbalance:
 *   A 3-candle pattern where the high of candle A and low of
 *   candle C do not overlap (or vice versa).
 *
 * Lifecycle:
 *   ACTIVE → PARTIAL → FULL_FILLED → INVALIDATED
 *
 * Anti-lookahead:
 *   - Detection uses only candles[i-2..i].
 *   - Lifecycle updates use only the current candle.
 *   - getFVGsAsOf(zone, index) filters.
 *
 * Determinism:
 *   - No Math.random.
 *   - Stable IDs derived from index + prices.
 */

import {
  AtrArray,
  FVGDetectionConfig,
  FVGDirection,
  FVGStatus,
  FVGZone,
  NormalizedCandle,
  DEFAULT_FVG_CONFIG,
} from './types';

/**
 * Build a stable ID for an FVG.
 * Format: fvg_<dir>_<index>_<bottom>_<top>
 */
function buildFvgId(
  direction: FVGDirection,
  index: number,
  bottom: number,
  top: number,
): string {
  const dirShort = direction === 'BULLISH' ? 'b' : 's';
  return `fvg_${dirShort}_${index}_${bottom.toFixed(4)}_${top.toFixed(4)}`;
}

/**
 * Detect all FVGs in the candle array.
 */
export function detectFVGs(
  candles: ReadonlyArray<NormalizedCandle>,
  atr: AtrArray,
  config: FVGDetectionConfig = DEFAULT_FVG_CONFIG,
): FVGZone[] {
  if (config.minGapAtrRatio < 0) {
    throw new Error('minGapAtrRatio must be >= 0');
  }

  const zones: FVGZone[] = [];
  const n = candles.length;

  for (let i = 2; i < n; i++) {
    const A = candles[i - 2];
    const C = candles[i];

    // Need ATR available at index i
    const currentAtr = atr[i];
    if (currentAtr === null || currentAtr <= 0) continue;

    // Bullish FVG (BISI)
    if (C.low > A.high) {
      const bottom = A.high;
      const top = C.low;
      const size = top - bottom;
      if (size / currentAtr >= config.minGapAtrRatio) {
        zones.push({
          id: buildFvgId('BULLISH', i, bottom, top),
          direction: 'BULLISH',
          bottom,
          top,
          size,
          createdAtIndex: i,
          createdAt: C.time,
          status: 'ACTIVE',
          firstTouchIndex: null,
          fullFillIndex: null,
          invalidationIndex: null,
          confirmedAtIndex: i,
        });
      }
    }

    // Bearish FVG (SIBI)
    if (C.high < A.low) {
      const bottom = C.high;
      const top = A.low;
      const size = top - bottom;
      if (size / currentAtr >= config.minGapAtrRatio) {
        zones.push({
          id: buildFvgId('BEARISH', i, bottom, top),
          direction: 'BEARISH',
          bottom,
          top,
          size,
          createdAtIndex: i,
          createdAt: C.time,
          status: 'ACTIVE',
          firstTouchIndex: null,
          fullFillIndex: null,
          invalidationIndex: null,
          confirmedAtIndex: i,
        });
      }
    }
  }

  return zones;
}

/**
 * Update an FVG's status using ONE new candle.
 *
 * @param zone - Current FVG state
 * @param candle - The new candle
 * @param candleIndex - Index of the new candle (must be > zone.createdAtIndex)
 * @returns Updated FVG (immutable)
 */
export function updateFVGWithCandle(
  zone: FVGZone,
  candle: NormalizedCandle,
  candleIndex: number,
): FVGZone {
  // Don't touch completed zones
  if (
    zone.status === 'FULL_FILLED' ||
    zone.status === 'INVALIDATED'
  ) {
    return zone;
  }

  // Don't update if this candle is before or at creation
  if (candleIndex <= zone.createdAtIndex) {
    return zone;
  }

  const inZone = candle.low <= zone.top && candle.high >= zone.bottom;

  if (zone.direction === 'BULLISH') {
    // Bullish FVG fills when price drops into it
    // Full fill: candle.low <= zone.bottom
    // Invalidation: candle.close < zone.bottom (price broke below)
    if (candle.low <= zone.bottom) {
      // Full fill (or invalidation)
      if (candle.close < zone.bottom) {
        return {
          ...zone,
          status: 'INVALIDATED',
          invalidationIndex: candleIndex,
          fullFillIndex: zone.fullFillIndex ?? candleIndex,
          firstTouchIndex: zone.firstTouchIndex ?? candleIndex,
        };
      }
      return {
        ...zone,
        status: 'FULL_FILLED',
        fullFillIndex: zone.fullFillIndex ?? candleIndex,
        firstTouchIndex: zone.firstTouchIndex ?? candleIndex,
      };
    }

    if (inZone) {
      return {
        ...zone,
        status: zone.status === 'ACTIVE' ? 'PARTIAL' : zone.status,
        firstTouchIndex: zone.firstTouchIndex ?? candleIndex,
      };
    }
  } else {
    // Bearish FVG fills when price rises into it
    if (candle.high >= zone.top) {
      if (candle.close > zone.top) {
        return {
          ...zone,
          status: 'INVALIDATED',
          invalidationIndex: candleIndex,
          fullFillIndex: zone.fullFillIndex ?? candleIndex,
          firstTouchIndex: zone.firstTouchIndex ?? candleIndex,
        };
      }
      return {
        ...zone,
        status: 'FULL_FILLED',
        fullFillIndex: zone.fullFillIndex ?? candleIndex,
        firstTouchIndex: zone.firstTouchIndex ?? candleIndex,
      };
    }

    if (inZone) {
      return {
        ...zone,
        status: zone.status === 'ACTIVE' ? 'PARTIAL' : zone.status,
        firstTouchIndex: zone.firstTouchIndex ?? candleIndex,
      };
    }
  }

  return zone;
}

/**
 * Replay all candles to compute the full lifecycle of each zone.
 * This is the ONLY way to get historical zone states.
 */
export function replayFVGLifecycle(
  zones: ReadonlyArray<FVGZone>,
  candles: ReadonlyArray<NormalizedCandle>,
): FVGZone[] {
  const result: FVGZone[] = zones.map((z) => ({ ...z }));

  for (let i = 0; i < candles.length; i++) {
    for (let z = 0; z < result.length; z++) {
      if (result[z].createdAtIndex < i) {
        result[z] = updateFVGWithCandle(result[z], candles[i], i);
      }
    }
  }

  return result;
}

/**
 * Filter zones confirmed as of a given index.
 */
export function getFVGsAsOf(
  zones: ReadonlyArray<FVGZone>,
  asOfIndex: number,
): FVGZone[] {
  return zones.filter((z) => z.confirmedAtIndex <= asOfIndex);
}

/**
 * Get zones that are currently ACTIVE (unfilled).
 */
export function getActiveFVGs(
  zones: ReadonlyArray<FVGZone>,
): FVGZone[] {
  return zones.filter((z) => z.status === 'ACTIVE');
}

/**
 * Check if a price is inside a zone.
 */
export function isPriceInFVG(zone: FVGZone, price: number): boolean {
  return price >= zone.bottom && price <= zone.top;
}
