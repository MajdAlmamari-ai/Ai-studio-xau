import { describe, it, expect } from 'vitest';
import {
  getResampleRatio,
  canResample,
  resampleCandles,
} from '../resampling/resampler';
import {
  aggregateAllTimeframes,
} from '../resampling/aggregator';
import { NormalizedCandle } from '../resampling/types';

function makeCandle(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 100,
): NormalizedCandle {
  return { time, timeFormatted: '', open, high, low, close, volume };
}

const M15 = 15 * 60;
const H1 = 60 * 60;

describe('Resampler — ratio', () => {
  it('computes correct ratios', () => {
    expect(getResampleRatio('M15', 'M30')).toBe(2);
    expect(getResampleRatio('M15', 'H1')).toBe(4);
    expect(getResampleRatio('M15', 'H4')).toBe(16);
    expect(getResampleRatio('H1', 'H4')).toBe(4);
  });

  it('returns null for invalid ratios', () => {
    expect(getResampleRatio('H1', 'M15')).toBeNull();
    expect(getResampleRatio('M15', 'M45')).toBeNull();
    expect(getResampleRatio('INVALID', 'H1')).toBeNull();
  });

  it('canResample works', () => {
    expect(canResample('M15', 'H1')).toBe(true);
    expect(canResample('H1', 'M15')).toBe(false);
  });
});

describe('Resampler — aggregation', () => {
  it('aggregates 4 M15 candles into 1 H1 candle', () => {
    const start = 1_700_000_000;
    const candles = [
      makeCandle(start + 0 * M15, 100, 105, 99, 104, 50),
      makeCandle(start + 1 * M15, 104, 110, 103, 108, 60),
      makeCandle(start + 2 * M15, 108, 109, 102, 103, 70),
      makeCandle(start + 3 * M15, 103, 107, 101, 106, 40),
    ];

    const result = resampleCandles(candles, 'M15', 'H1');
    expect(result.ok).toBe(true);
    expect(result.candles.length).toBe(1);
    const h1 = result.candles[0];
    expect(h1.open).toBe(100);
    expect(h1.high).toBe(110);
    expect(h1.low).toBe(99);
    expect(h1.close).toBe(106);
    expect(h1.volume).toBe(220);
  });

  it('returns error for empty source', () => {
    const result = resampleCandles([], 'M15', 'H1');
    expect(result.ok).toBe(false);
    expect(result.reason?.code).toBe('EMPTY_SOURCE');
  });

  it('returns error for invalid ratio', () => {
    const candles = [makeCandle(1_700_000_000, 100, 101, 99, 100)];
    const result = resampleCandles(candles, 'H1', 'M15');
    expect(result.ok).toBe(false);
    expect(result.reason?.code).toBe('INVALID_RESAMPLE_RATIO');
  });

  it('deterministic', () => {
    const start = 1_700_000_000;
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(start + i * M15, 100 + i, 102 + i, 99 + i, 101 + i),
    );
    const a = resampleCandles(candles, 'M15', 'H1');
    const b = resampleCandles(candles, 'M15', 'H1');
    expect(a).toEqual(b);
  });
});

describe('Aggregator — batch', () => {
  it('produces all higher timeframes from M15', () => {
    const start = 1_700_000_000;
    const candles = Array.from({ length: 96 }, (_, i) =>
      makeCandle(start + i * M15, 100, 101, 99, 100),
    );

    const result = aggregateAllTimeframes(candles, 'M15');
    expect(result.ok).toBe(true);
    expect(result.timeframes.M15).toBeDefined();
    expect(result.timeframes.M30).toBeDefined();
    expect(result.timeframes.H1).toBeDefined();
    expect(result.timeframes.H4).toBeDefined();
    expect(result.timeframes.D1).toBeDefined();
  });

  it('lower timeframes not present', () => {
    const start = 1_700_000_000;
    const candles = Array.from({ length: 48 }, (_, i) =>
      makeCandle(start + i * H1, 100, 101, 99, 100),
    );

    const result = aggregateAllTimeframes(candles, 'H1');
    expect(result.timeframes.M15).toBeUndefined();
    expect(result.timeframes.H1).toBeDefined();
    expect(result.timeframes.H4).toBeDefined();
  });

  it('throws for empty input', () => {
    const result = aggregateAllTimeframes([], 'M15');
    expect(result.ok).toBe(false);
    expect(result.reason?.code).toBe('EMPTY_BASE');
  });
});
