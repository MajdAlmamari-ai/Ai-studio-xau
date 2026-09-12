import { describe, it, expect } from 'vitest';
import {
  calculateTrueRange,
  calculateATR,
  getATR,
  getLatestATR,
  computeSpringCoilMeta,
  calculateATRWithSpringCoil,
} from '../atr';
import { NormalizedCandle } from '../types';

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

describe('ATR — True Range', () => {
  it('uses high-low for first candle', () => {
    const c = makeCandle(0, 100, 105, 95, 102);
    expect(calculateTrueRange(c, null)).toBe(10);
  });

  it('uses max of three when previous exists', () => {
    const prev = makeCandle(0, 100, 102, 98, 100);
    const curr = makeCandle(1, 110, 112, 109, 111);
    expect(calculateTrueRange(curr, prev)).toBe(12);
  });
});

describe('ATR — calculation', () => {
  it('returns empty for empty input', () => {
    expect(calculateATR([])).toEqual([]);
  });

  it('throws for period < 1', () => {
    const c = makeCandle(0, 100, 101, 99, 100);
    expect(() => calculateATR([c], 0)).toThrow();
    expect(() => calculateATR([c], -1)).toThrow();
  });

  it('returns all null when candles < period', () => {
    const candles = [
      makeCandle(0, 100, 101, 99, 100),
      makeCandle(1, 100, 102, 99, 101),
    ];
    expect(calculateATR(candles, 14)).toEqual([null, null]);
  });

  it('first ATR value is at index period-1', () => {
    const candles = [
      makeCandle(0, 100, 105, 95, 102),
      makeCandle(1, 102, 106, 100, 104),
      makeCandle(2, 104, 108, 102, 106),
    ];
    const atr = calculateATR(candles, 3);
    expect(atr[0]).toBeNull();
    expect(atr[1]).toBeNull();
    expect(typeof atr[2]).toBe('number');
  });

  it('deterministic', () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(i, 100 + i, 102 + i, 98 + i, 101 + i),
    );
    const a = calculateATR(candles, 3);
    const b = calculateATR(candles, 3);
    expect(a).toEqual(b);
  });

  it('never returns 0 or NaN after warmup', () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(i, 100 + i, 102 + i, 98 + i, 101 + i),
    );
    const atr = calculateATR(candles, 5);
    atr.forEach((v, i) => {
      if (i < 4) {
        expect(v).toBeNull();
      } else {
        expect(v).not.toBeNull();
        expect(Number.isFinite(v as number)).toBe(true);
        expect(v as number).toBeGreaterThan(0);
      }
    });
  });
});

describe('ATR — helpers', () => {
  it('getATR returns null for out-of-range', () => {
    const atr = [null, null, 1.5];
    expect(getATR(atr, -1)).toBeNull();
    expect(getATR(atr, 99)).toBeNull();
    expect(getATR(atr, 2)).toBe(1.5);
  });

  it('getLatestATR returns last value or null', () => {
    expect(getLatestATR([])).toBeNull();
    expect(getLatestATR([null, null, 1.5])).toBe(1.5);
    expect(getLatestATR([null, null])).toBeNull();
  });
});

describe('ATR — Spring Coil', () => {
  it('returns null meta for empty array', () => {
    const meta = computeSpringCoilMeta([]);
    expect(meta.currentATR).toBeNull();
    expect(meta.lowestATR20).toBeNull();
    expect(meta.isSpringCoilActive).toBe(false);
  });

  it('detects compression when ratio <= 1.15', () => {
    const atr = [null, null, 2.0, 1.8, 1.5, 1.2, 1.0, 0.95, 0.92, 0.9];
    const meta = computeSpringCoilMeta(atr, 20, 1.15);
    expect(meta.currentATR).toBe(0.9);
    expect(meta.lowestATR20).toBe(0.9);
    expect(meta.springCoilRatio).toBe(1.0);
    expect(meta.isSpringCoilActive).toBe(true);
  });

  it('no compression when ratio > 1.15', () => {
    const atr = [null, null, 1.0, 1.1, 1.5, 2.0, 2.5];
    const meta = computeSpringCoilMeta(atr, 20, 1.15);
    expect(meta.currentATR).toBe(2.5);
    expect(meta.isSpringCoilActive).toBe(false);
  });

  it('calculateATRWithSpringCoil returns both parts', () => {
    const candles = Array.from({ length: 30 }, (_, i) =>
      makeCandle(i, 100 + i * 0.5, 102 + i * 0.5, 99 + i * 0.5, 101 + i * 0.5),
    );
    const result = calculateATRWithSpringCoil(candles, 14);
    expect(Array.isArray(result.atr)).toBe(true);
    expect(result.atr.length).toBe(30);
    expect(result.springCoil).toBeDefined();
  });
});
