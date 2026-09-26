/**
 * Aggregator
 *
 * Resamples ONE base timeframe into ALL higher timeframes.
 *
 * Example:
 *   Input: M15 candles
 *   Output: {
 *     M15: original,
 *     M30: resampled,
 *     H1: resampled,
 *     H4: resampled,
 *     D1: resampled,
 *     W1: resampled,
 *     MN1: resampled,
 *   }
 *
 * Deterministic. NO Math.random.
 */

import { ALL_TIMEFRAMES as CANONICAL_ALL_TIMEFRAMES, Timeframe } from '../../constants/timeframes';
import { resampleCandles, canResample } from './resampler';
import { NormalizedCandle } from './types';

export type TimeframeKey = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1' | 'MN1';

export const CANONICAL_TO_LEGACY_TIMEFRAME: Record<Timeframe, TimeframeKey> = {
  '1m': 'M1',
  '5m': 'M5',
  '15m': 'M15',
  '30m': 'M30',
  '1h': 'H1',
  '4h': 'H4',
  '1d': 'D1',
  '1w': 'W1',
};

export const LEGACY_TO_CANONICAL_TIMEFRAME: Partial<Record<TimeframeKey, Timeframe>> = {
  M1: '1m',
  M5: '5m',
  M15: '15m',
  M30: '30m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
  W1: '1w',
};

export interface AggregationResult {
  ok: boolean;
  baseTimeframe: TimeframeKey;
  timeframes: Partial<Record<TimeframeKey, NormalizedCandle[]>>;
  reason?: {
    code: string;
    shortAr: string;
    detailsAr: string;
    howToFix: string[];
  };
}

// Derived from canonical timeframes plus monthly (MN1)
const ALL_TIMEFRAMES: TimeframeKey[] = [
  ...CANONICAL_ALL_TIMEFRAMES.map((tf) => CANONICAL_TO_LEGACY_TIMEFRAME[tf]),
  'MN1',
];

/**
 * Aggregate a base timeframe into all higher timeframes.
 *
 * Lower timeframes than base are NOT computed (returns undefined).
 */
export function aggregateAllTimeframes(
  baseCandles: ReadonlyArray<NormalizedCandle>,
  baseTimeframe: TimeframeKey,
): AggregationResult {
  if (baseCandles.length === 0) {
    return {
      ok: false,
      baseTimeframe,
      timeframes: {},
      reason: {
        code: 'EMPTY_BASE',
        shortAr: 'الإطار الأساسي فارغ',
        detailsAr: 'No candles provided.',
        howToFix: ['تحقق من جلب البيانات'],
      },
    };
  }

  const timeframes: Partial<Record<TimeframeKey, NormalizedCandle[]>> = {};

  for (const tf of ALL_TIMEFRAMES) {
    if (tf === baseTimeframe) {
      timeframes[tf] = [...baseCandles];
      continue;
    }

    if (!canResample(baseTimeframe, tf)) {
      // Lower or incompatible timeframe; skip.
      continue;
    }

    const result = resampleCandles(baseCandles, baseTimeframe, tf);
    if (result.ok) {
      timeframes[tf] = result.candles;
    }
  }

  return {
    ok: true,
    baseTimeframe,
    timeframes,
  };
}
