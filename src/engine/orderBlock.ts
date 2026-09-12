/**
 * Order Block (OB) Detection.
 *
 * An Order Block is the origin candle before a confirmed BOS
 * (Break of Structure) with strong displacement.
 *
 * Detection rules:
 *   1. For each BOS_UP/BOS_DOWN break:
 *      a. Look back up to `maxLookback` candles for the origin.
 *      b. For BULLISH OB: origin must be a bearish candle
 *         (close < open).
 *      c. For BEARISH OB: origin must be a bullish candle
 *         (close > open).
 *      d. Choose the LAST such candle (closest to the break).
 *   2. The break candle must have a body >= `minDisplacementAtr * ATR`.
 *   3. The origin's range must be <= `maxOriginRangeAtr * ATR`.
 *
 * Anti-lookahead:
 *   - OB is only created at `break.breakIndex` or later.
 *   - Lifecycle updates use only the current candle.
 */

import {
  AtrArray,
  NormalizedCandle,
  OBDetectionConfig,
  OBDirection,
  OrderBlock,
  StructureBreak,
  DEFAULT_OB_CONFIG,
} from './types';

function buildObId(
  direction: OBDirection,
  originIndex: number,
  bottom: number,
  top: number,
): string {
  const dirShort = direction === 'BULLISH' ? 'bull' : 'bear';
  return `ob_${dirShort}_${originIndex}_${bottom.toFixed(4)}_${top.toFixed(4)}`;
}

/**
 * Detect Order Blocks from confirmed breaks.
 */
export function detectOrderBlocks(
  candles: ReadonlyArray<NormalizedCandle>,
  atr: AtrArray,
  breaks: ReadonlyArray<StructureBreak>,
  config: OBDetectionConfig = DEFAULT_OB_CONFIG,
): OrderBlock[] {
  if (config.maxLookback < 1) {
    throw new Error('maxLookback must be >= 1');
  }
  if (config.minDisplacementAtr < 0) {
    throw new Error('minDisplacementAtr must be >= 0');
  }
  if (config.maxOriginRangeAtr <= 0) {
    throw new Error('maxOriginRangeAtr must be > 0');
  }

  const result: OrderBlock[] = [];

  for (const brk of breaks) {
    if (brk.type !== 'BOS_UP' && brk.type !== 'BOS_DOWN') continue;

    const breakIdx = brk.breakIndex;
    const breakAtr = atr[breakIdx];
    if (breakAtr === null || breakAtr <= 0) continue;

    const breakCandle = candles[breakIdx];
    const breakBody = Math.abs(breakCandle.close - breakCandle.open);
    const displacementAtr = breakBody / breakAtr;

    if (displacementAtr < config.minDisplacementAtr) continue;

    // Find the origin candle
    const direction: OBDirection =
      brk.type === 'BOS_UP' ? 'BULLISH' : 'BEARISH';

    let originIdx: number | null = null;
    const startIdx = Math.max(0, breakIdx - config.maxLookback);

    for (let i = breakIdx - 1; i >= startIdx; i--) {
      const c = candles[i];
      const isBearish = c.close < c.open;
      const isBullish = c.close > c.open;

      if (direction === 'BULLISH' && isBearish) {
        const range = c.high - c.low;
        if (range > 0 && range / breakAtr <= config.maxOriginRangeAtr) {
          originIdx = i;
          break;
        }
      } else if (direction === 'BEARISH' && isBullish) {
        const range = c.high - c.low;
        if (range > 0 && range / breakAtr <= config.maxOriginRangeAtr) {
          originIdx = i;
          break;
        }
      }
    }

    if (originIdx === null) continue;

    const origin = candles[originIdx];

    result.push({
      id: buildObId(direction, originIdx, origin.low, origin.high),
      direction,
      bottom: origin.low,
      top: origin.high,
      originIndex: originIdx,
      originTime: origin.time,
      breakIndex: breakIdx,
      breakType: brk.type as 'BOS_UP' | 'BOS_DOWN',
      displacementAtr,
      status: 'ACTIVE',
      mitigationCount: 0,
      firstMitigationIndex: null,
      lastMitigationIndex: null,
      invalidationIndex: null,
      confirmedAtIndex: breakIdx,
    });
  }

  return result;
}

/**
 * Update an OB's lifecycle with ONE candle.
 */
export function updateOBWithCandle(
  ob: OrderBlock,
  candle: NormalizedCandle,
  candleIndex: number,
): OrderBlock {
  if (ob.status === 'INVALIDATED') return ob;
  if (candleIndex <= ob.breakIndex) return ob;

  const inZone = candle.low <= ob.top && candle.high >= ob.bottom;

  if (ob.direction === 'BULLISH') {
    // Invalidation: close below OB bottom
    if (candle.close < ob.bottom) {
      return {
        ...ob,
        status: 'INVALIDATED',
        invalidationIndex: candleIndex,
      };
    }
    // Mitigation: price touched zone
    if (inZone) {
      const isNew = ob.lastMitigationIndex === null ||
        candleIndex - ob.lastMitigationIndex > 1;
      return {
        ...ob,
        status: 'MITIGATED',
        mitigationCount: isNew ? ob.mitigationCount + 1 : ob.mitigationCount,
        firstMitigationIndex: ob.firstMitigationIndex ?? candleIndex,
        lastMitigationIndex: candleIndex,
      };
    }
  } else {
    // Invalidation: close above OB top
    if (candle.close > ob.top) {
      return {
        ...ob,
        status: 'INVALIDATED',
        invalidationIndex: candleIndex,
      };
    }
    if (inZone) {
      const isNew = ob.lastMitigationIndex === null ||
        candleIndex - ob.lastMitigationIndex > 1;
      return {
        ...ob,
        status: 'MITIGATED',
        mitigationCount: isNew ? ob.mitigationCount + 1 : ob.mitigationCount,
        firstMitigationIndex: ob.firstMitigationIndex ?? candleIndex,
        lastMitigationIndex: candleIndex,
      };
    }
  }

  return ob;
}

/**
 * Replay full lifecycle.
 */
export function replayOBLifecycle(
  obs: ReadonlyArray<OrderBlock>,
  candles: ReadonlyArray<NormalizedCandle>,
): OrderBlock[] {
  const result: OrderBlock[] = obs.map((o) => ({ ...o }));

  for (let i = 0; i < candles.length; i++) {
    for (let k = 0; k < result.length; k++) {
      if (result[k].breakIndex < i) {
        result[k] = updateOBWithCandle(result[k], candles[i], i);
      }
    }
  }

  return result;
}

/**
 * Filter OBs confirmed as of a given index.
 */
export function getOBsAsOf(
  obs: ReadonlyArray<OrderBlock>,
  asOfIndex: number,
): OrderBlock[] {
  return obs.filter((o) => o.confirmedAtIndex <= asOfIndex);
}

/**
 * Get active OBs only.
 */
export function getActiveOBs(
  obs: ReadonlyArray<OrderBlock>,
): OrderBlock[] {
  return obs.filter((o) => o.status === 'ACTIVE');
}

/**
 * Check if price is inside OB zone.
 */
export function isPriceInOB(ob: OrderBlock, price: number): boolean {
  return price >= ob.bottom && price <= ob.top;
}
