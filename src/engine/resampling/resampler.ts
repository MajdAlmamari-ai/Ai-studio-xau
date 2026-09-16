/**
 * Resampler
 *
 * Aggregates lower-timeframe candles into higher-timeframe candles.
 *
 * Rules:
 *   Open  = first candle's open
 *   High  = max of highs
 *   Low   = min of lows
 *   Close = last candle's close
 *   Volume = sum
 *   Time = first candle's time
 *
 * Deterministic. NO Math.random.
 * NO lookahead: only uses candles within the target period.
 */

import {
  NormalizedCandle,
  ResampleResult,
  TIMEFRAME_MINUTES,
} from './types';

/**
 * Compute the ratio between two timeframes.
 * Returns null if invalid.
 */
export function getResampleRatio(
  fromTimeframe: string,
  toTimeframe: string,
): number | null {
  const fromMin = TIMEFRAME_MINUTES[fromTimeframe];
  const toMin = TIMEFRAME_MINUTES[toTimeframe];
  if (!fromMin || !toMin) return null;
  if (toMin <= fromMin) return null;
  if (toMin % fromMin !== 0) return null;
  return toMin / fromMin;
}

/**
 * Check if a source timeframe can be resampled to target.
 */
export function canResample(
  fromTimeframe: string,
  toTimeframe: string,
): boolean {
  return getResampleRatio(fromTimeframe, toTimeframe) !== null;
}

/**
 * Resample candles from a lower timeframe to a higher timeframe.
 */
export function resampleCandles(
  source: ReadonlyArray<NormalizedCandle>,
  fromTimeframe: string,
  toTimeframe: string,
): ResampleResult {
  const ratio = getResampleRatio(fromTimeframe, toTimeframe);

  if (ratio === null) {
    return {
      ok: false,
      candles: [],
      ratio: 0,
      fromTimeframe,
      toTimeframe,
      reason: {
        code: 'INVALID_RESAMPLE_RATIO',
        shortAr: 'نسبة التحويل غير صالحة',
        detailsAr: `Cannot resample ${fromTimeframe} to ${toTimeframe}`,
        howToFix: [
          'تأكد أن الإطار الأعلى مضاعف للإطار الأصلي',
          'مثال: M15 → H1 = 4 (صالح)',
        ],
      },
    };
  }

  if (source.length === 0) {
    return {
      ok: false,
      candles: [],
      ratio,
      fromTimeframe,
      toTimeframe,
      reason: {
        code: 'EMPTY_SOURCE',
        shortAr: 'مصدر فارغ',
        detailsAr: 'No source candles provided.',
        howToFix: ['تحقق من جلب البيانات'],
      },
    };
  }

  const targetMinutes = TIMEFRAME_MINUTES[toTimeframe];
  const targetPeriodSec = targetMinutes * 60;

  const aggregated: NormalizedCandle[] = [];

  let currentPeriodStart = Math.floor(source[0].time / targetPeriodSec) * targetPeriodSec;
  let group: NormalizedCandle[] = [];

  const flush = () => {
    if (group.length === 0) return;
    const first = group[0];
    const last = group[group.length - 1];
    let high = group[0].high;
    let low = group[0].low;
    let volume = 0;
    for (const c of group) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      volume += c.volume;
    }
    aggregated.push({
      time: currentPeriodStart,
      timeFormatted: first.timeFormatted,
      open: first.open,
      high,
      low,
      close: last.close,
      volume,
    });
  };

  for (const candle of source) {
    const periodStart = Math.floor(candle.time / targetPeriodSec) * targetPeriodSec;
    if (periodStart !== currentPeriodStart) {
      flush();
      group = [];
      currentPeriodStart = periodStart;
    }
    group.push(candle);
  }
  flush();

  return {
    ok: true,
    candles: aggregated,
    ratio,
    fromTimeframe,
    toTimeframe,
  };
}
