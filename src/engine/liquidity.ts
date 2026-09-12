/**
 * Liquidity Levels and Sweep Detection.
 *
 * Levels:
 *   - PDH/PDL: Previous Day High/Low.
 *   - PWH/PWL: Previous Week High/Low.
 *   - Session extremes: Asian, London, NY.
 *   - Equal Highs/Lows: swings within tolerance.
 *
 * We work on a rolling basis using UTC calendar days and weeks
 * (24h / 168h) because the engine only receives candle data.
 *
 * Anti-lookahead: all levels use only candles up to their
 * confirmedAtIndex.
 */

import {
  AtrArray,
  LiquidityDetectionConfig,
  LiquidityLevel,
  LiquidityLevelType,
  NormalizedCandle,
  SweepDirection,
  SweepEvent,
  DEFAULT_LIQUIDITY_CONFIG,
} from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

function buildLevelId(
  type: LiquidityLevelType,
  price: number,
  index: number,
): string {
  return `lvl_${type.toLowerCase()}_${index}_${price.toFixed(4)}`;
}

function buildSweepId(
  direction: SweepDirection,
  index: number,
  price: number,
): string {
  return `swp_${direction.toLowerCase()}_${index}_${price.toFixed(4)}`;
}

/**
 * Compute Previous Day / Week High / Low.
 * A "day" or "week" is defined in UTC based on candle.time (seconds).
 */
export function detectLiquidityLevels(
  candles: ReadonlyArray<NormalizedCandle>,
): LiquidityLevel[] {
  const levels: LiquidityLevel[] = [];
  const n = candles.length;
  if (n === 0) return levels;

  // Group candle indices by UTC day and week.
  const dayBuckets = new Map<number, number[]>();
  const weekBuckets = new Map<number, number[]>();

  for (let i = 0; i < n; i++) {
    const t = candles[i].time * 1000;
    const day = Math.floor(t / MS_PER_DAY);
    const week = Math.floor(t / MS_PER_WEEK);
    if (!dayBuckets.has(day)) dayBuckets.set(day, []);
    if (!weekBuckets.has(week)) weekBuckets.set(week, []);
    dayBuckets.get(day)!.push(i);
    weekBuckets.get(week)!.push(i);
  }

  const dayKeys = Array.from(dayBuckets.keys()).sort((a, b) => a - b);
  const weekKeys = Array.from(weekBuckets.keys()).sort((a, b) => a - b);

  // For each day except the first, compute previous day's high/low.
  for (let k = 1; k < dayKeys.length; k++) {
    const prevIdx = dayBuckets.get(dayKeys[k - 1])!;
    let high = -Infinity;
    let low = Infinity;
    for (const i of prevIdx) {
      if (candles[i].high > high) high = candles[i].high;
      if (candles[i].low < low) low = candles[i].low;
    }
    const firstIdx = dayBuckets.get(dayKeys[k])![0];
    const t = candles[firstIdx].time;
    levels.push({
      id: buildLevelId('PDH', high, firstIdx),
      type: 'PDH',
      price: high,
      createdAt: t,
      createdAtIndex: firstIdx,
      source: 'prev_day_high',
      confirmedAtIndex: firstIdx,
    });
    levels.push({
      id: buildLevelId('PDL', low, firstIdx),
      type: 'PDL',
      price: low,
      createdAt: t,
      createdAtIndex: firstIdx,
      source: 'prev_day_low',
      confirmedAtIndex: firstIdx,
    });
  }

  // For each week except the first, compute previous week's high/low.
  for (let k = 1; k < weekKeys.length; k++) {
    const prevIdx = weekBuckets.get(weekKeys[k - 1])!;
    let high = -Infinity;
    let low = Infinity;
    for (const i of prevIdx) {
      if (candles[i].high > high) high = candles[i].high;
      if (candles[i].low < low) low = candles[i].low;
    }
    const firstIdx = weekBuckets.get(weekKeys[k])![0];
    const t = candles[firstIdx].time;
    levels.push({
      id: buildLevelId('PWH', high, firstIdx),
      type: 'PWH',
      price: high,
      createdAt: t,
      createdAtIndex: firstIdx,
      source: 'prev_week_high',
      confirmedAtIndex: firstIdx,
    });
    levels.push({
      id: buildLevelId('PWL', low, firstIdx),
      type: 'PWL',
      price: low,
      createdAt: t,
      createdAtIndex: firstIdx,
      source: 'prev_week_low',
      confirmedAtIndex: firstIdx,
    });
  }

  // Session extremes: rolling 8-hour windows (approximates Asian,
  // London, NY). We mark each 8-hour block's extreme.
  const BLOCK_HOURS = 8;
  const MS_PER_BLOCK = BLOCK_HOURS * 60 * 60 * 1000;

  // For each completed block, emit SESSION_HIGH/LOW.
  const sessionBuckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const t = candles[i].time * 1000;
    const block = Math.floor(t / MS_PER_BLOCK);
    if (!sessionBuckets.has(block)) sessionBuckets.set(block, []);
    sessionBuckets.get(block)!.push(i);
  }
  const blockKeys = Array.from(sessionBuckets.keys()).sort((a, b) => a - b);
  for (let k = 1; k < blockKeys.length; k++) {
    const prev = sessionBuckets.get(blockKeys[k - 1])!;
    let high = -Infinity;
    let low = Infinity;
    for (const i of prev) {
      if (candles[i].high > high) high = candles[i].high;
      if (candles[i].low < low) low = candles[i].low;
    }
    const firstIdx = sessionBuckets.get(blockKeys[k])![0];
    const t = candles[firstIdx].time;
    levels.push({
      id: buildLevelId('SESSION_HIGH', high, firstIdx),
      type: 'SESSION_HIGH',
      price: high,
      createdAt: t,
      createdAtIndex: firstIdx,
      source: 'prev_session_high',
      confirmedAtIndex: firstIdx,
    });
    levels.push({
      id: buildLevelId('SESSION_LOW', low, firstIdx),
      type: 'SESSION_LOW',
      price: low,
      createdAt: t,
      createdAtIndex: firstIdx,
      source: 'prev_session_low',
      confirmedAtIndex: firstIdx,
    });
  }

  return levels;
}

/**
 * Detect Equal Highs / Lows among recent confirmed swings.
 * Equal = |price_a - price_b| <= toleranceAtr * ATR
 */
export function detectEqualLevels(
  candles: ReadonlyArray<NormalizedCandle>,
  atr: AtrArray,
  swings: ReadonlyArray<{ type: 'HIGH' | 'LOW'; price: number; index: number; time: number; confirmedAtIndex: number }>,
  config: LiquidityDetectionConfig = DEFAULT_LIQUIDITY_CONFIG,
): LiquidityLevel[] {
  const levels: LiquidityLevel[] = [];
  const highs = swings.filter((s) => s.type === 'HIGH');
  const lows = swings.filter((s) => s.type === 'LOW');

  const checkPair = (
    swA: typeof swings[number],
    swB: typeof swings[number],
    type: LiquidityLevelType,
  ) => {
    const a = atr[swB.confirmedAtIndex];
    if (a === null || a <= 0) return;
    if (Math.abs(swA.price - swB.price) <= config.equalToleranceAtr * a) {
      const avg = (swA.price + swB.price) / 2;
      levels.push({
        id: buildLevelId(type, avg, swB.confirmedAtIndex),
        type,
        price: avg,
        createdAt: swB.time,
        createdAtIndex: swB.confirmedAtIndex,
        source: `equal_${type.toLowerCase()}`,
        confirmedAtIndex: swB.confirmedAtIndex,
      });
    }
  };

  for (let i = 1; i < highs.length; i++) {
    checkPair(highs[i - 1], highs[i], 'EQUAL_HIGHS');
  }
  for (let i = 1; i < lows.length; i++) {
    checkPair(lows[i - 1], lows[i], 'EQUAL_LOWS');
  }

  return levels;
}

/**
 * Detect sweeps of any level.
 *
 * sweepUp:
 *   candle.high > level.price + alpha * ATR
 *   AND candle.close < level.price
 *
 * sweepDown:
 *   candle.low < level.price - alpha * ATR
 *   AND candle.close > level.price
 */
export function detectSweeps(
  candles: ReadonlyArray<NormalizedCandle>,
  atr: AtrArray,
  levels: ReadonlyArray<LiquidityLevel>,
  config: LiquidityDetectionConfig = DEFAULT_LIQUIDITY_CONFIG,
): SweepEvent[] {
  const sweeps: SweepEvent[] = [];

  for (const level of levels) {
    for (let i = level.confirmedAtIndex; i < candles.length; i++) {
      const a = atr[i];
      if (a === null || a <= 0) continue;

      const c = candles[i];

      // Up sweep
      if (c.high > level.price + config.sweepAlphaAtr * a && c.close < level.price) {
        sweeps.push({
          id: buildSweepId('SWEEP_UP', i, level.price),
          direction: 'SWEEP_UP',
          levelId: level.id,
          levelPrice: level.price,
          candleIndex: i,
          candleTime: c.time,
          penetrationAtr: (c.high - level.price) / a,
          reclaimAtr: (level.price - c.close) / a,
          reclaimed: true,
        });
      }

      // Down sweep
      if (c.low < level.price - config.sweepAlphaAtr * a && c.close > level.price) {
        sweeps.push({
          id: buildSweepId('SWEEP_DOWN', i, level.price),
          direction: 'SWEEP_DOWN',
          levelId: level.id,
          levelPrice: level.price,
          candleIndex: i,
          candleTime: c.time,
          penetrationAtr: (level.price - c.low) / a,
          reclaimAtr: (c.close - level.price) / a,
          reclaimed: true,
        });
      }
    }
  }

  return sweeps;
}

/**
 * Filter levels visible at a given index.
 */
export function getLevelsAsOf(
  levels: ReadonlyArray<LiquidityLevel>,
  asOfIndex: number,
): LiquidityLevel[] {
  return levels.filter((l) => l.confirmedAtIndex <= asOfIndex);
}

/**
 * Filter sweeps up to a given index.
 */
export function getSweepsAsOf(
  sweeps: ReadonlyArray<SweepEvent>,
  asOfIndex: number,
): SweepEvent[] {
  return sweeps.filter((s) => s.candleIndex <= asOfIndex);
}
