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

import { resampleCandles, canResample } from './resampler';
import { NormalizedCandle } from './types';

export type TimeframeKey = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1' | 'MN1';

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

const ALL_TIMEFRAMES: TimeframeKey[] = [
  'M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1',
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
