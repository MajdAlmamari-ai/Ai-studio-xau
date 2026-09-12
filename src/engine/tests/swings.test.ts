import { describe, it, expect } from 'vitest';
import {
  detectSwings,
  getSwingsAsOf,
  getLatestSwing,
  getRecentSwings,
} from '../swings';
import { NormalizedCandle, SwingDetectionConfig } from '../types';

function makeCandle(
  index: number,
  high: number,
  low: number,
  close?: number,
): NormalizedCandle {
  const c = close ?? (high + low) / 2;
  const o = (high + low) / 2;
  return {
    time: 1_700_000_000 + index * 60,
    timeFormatted: '',
    open: o,
    high,
    low,
    close: c,
    volume: 100,
  };
}

const config: SwingDetectionConfig = { leftBars: 2, rightBars: 2 };

describe('Swings — detection', () => {
  it('throws for leftBars < 1', () => {
    const candles = [makeCandle(0, 100, 99)];
    expect(() =>
      detectSwings(candles, { leftBars: 0, rightBars: 1 }),
    ).toThrow();
  });

  it('throws for rightBars < 1', () => {
    const candles = [makeCandle(0, 100, 99)];
    expect(() =>
      detectSwings(candles, { leftBars: 1, rightBars: 0 }),
    ).toThrow();
  });

  it('returns empty for too-small array', () => {
    const candles = [
      makeCandle(0, 100, 99),
      makeCandle(1, 101, 100),
      makeCandle(2, 102, 101),
    ];
    expect(detectSwings(candles, config)).toEqual([]);
  });

  it('detects a clear swing high', () => {
    const candles = [
      makeCandle(0, 100, 98),
      makeCandle(1, 101, 99),
      makeCandle(2, 110, 105),
      makeCandle(3, 102, 100),
      makeCandle(4, 101, 99),
    ];
    const swings = detectSwings(candles, config);
    const highs = swings.filter((s) => s.type === 'HIGH');
    expect(highs.length).toBe(1);
    expect(highs[0].index).toBe(2);
    expect(highs[0].price).toBe(110);
    expect(highs[0].confirmedAtIndex).toBe(4);
  });

  it('detects a clear swing low', () => {
    const candles = [
      makeCandle(0, 102, 100),
      makeCandle(1, 101, 99),
      makeCandle(2, 100, 90),
      makeCandle(3, 101, 95),
      makeCandle(4, 102, 98),
    ];
    const swings = detectSwings(candles, config);
    const lows = swings.filter((s) => s.type === 'LOW');
    expect(lows.length).toBe(1);
    expect(lows[0].index).toBe(2);
    expect(lows[0].price).toBe(90);
    expect(lows[0].confirmedAtIndex).toBe(4);
  });

  it('confirmedAtIndex = index + rightBars', () => {
    const candles = [
      makeCandle(0, 100, 98),
      makeCandle(1, 101, 99),
      makeCandle(2, 110, 105),
      makeCandle(3, 102, 100),
      makeCandle(4, 101, 99),
    ];
    const swings = detectSwings(candles, config);
    swings.forEach((s) => {
      expect(s.confirmedAtIndex).toBe(s.index + config.rightBars);
    });
  });

  it('detects multiple swings', () => {
    const candles = [
      makeCandle(0, 100, 98),
      makeCandle(1, 101, 99),
      makeCandle(2, 110, 105),
      makeCandle(3, 102, 100),
      makeCandle(4, 103, 90),
      makeCandle(5, 104, 95),
      makeCandle(6, 105, 100),
    ];
    const swings = detectSwings(candles, config);
    expect(swings.length).toBeGreaterThanOrEqual(2);
    expect(swings.find((s) => s.type === 'HIGH')).toBeDefined();
    expect(swings.find((s) => s.type === 'LOW')).toBeDefined();
  });

  it('deterministic', () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i) * 5, 95 + Math.cos(i) * 3),
    );
    const a = detectSwings(candles, config);
    const b = detectSwings(candles, config);
    expect(a).toEqual(b);
  });
});

describe('Swings — anti-lookahead', () => {
  it('getSwingsAsOf filters correctly', () => {
    const candles = [
      makeCandle(0, 100, 98),
      makeCandle(1, 101, 99),
      makeCandle(2, 110, 105),
      makeCandle(3, 102, 100),
      makeCandle(4, 101, 99),
    ];
    const swings = detectSwings(candles, config);

    const at3 = getSwingsAsOf(swings, 3);
    expect(at3.filter((s) => s.type === 'HIGH').length).toBe(0);

    const at4 = getSwingsAsOf(swings, 4);
    expect(at4.filter((s) => s.type === 'HIGH').length).toBe(1);
  });

  it('swing result does not change when future candles are added', () => {
    const base = [
      makeCandle(0, 100, 98),
      makeCandle(1, 101, 99),
      makeCandle(2, 110, 105),
      makeCandle(3, 102, 100),
      makeCandle(4, 101, 99),
    ];
    const withFuture = [
      ...base,
      makeCandle(5, 103, 100),
      makeCandle(6, 104, 101),
      makeCandle(7, 105, 102),
    ];

    const swingsBase = detectSwings(base, config);
    const swingsFuture = detectSwings(withFuture, config).filter(
      (s) => s.confirmedAtIndex < base.length,
    );

    expect(swingsBase).toEqual(swingsFuture);
  });
});

describe('Swings — helpers', () => {
  it('getLatestSwing returns last of type', () => {
    const candles = [
      makeCandle(0, 100, 98),
      makeCandle(1, 101, 99),
      makeCandle(2, 110, 105),
      makeCandle(3, 102, 100),
      makeCandle(4, 103, 90),
      makeCandle(5, 104, 95),
      makeCandle(6, 105, 100),
    ];
    const swings = detectSwings(candles, config);
    const lastHigh = getLatestSwing(swings, 'HIGH');
    const lastLow = getLatestSwing(swings, 'LOW');
    if (lastHigh) expect(lastHigh.type).toBe('HIGH');
    if (lastLow) expect(lastLow.type).toBe('LOW');
  });

  it('getRecentSwings returns at most count', () => {
    const candles = Array.from({ length: 30 }, (_, i) =>
      makeCandle(i, 100 + i, 95 + i * 0.5),
    );
    const swings = detectSwings(candles, config);
    const recent = getRecentSwings(swings, 'HIGH', 3);
    expect(recent.length).toBeLessThanOrEqual(3);
  });
});
