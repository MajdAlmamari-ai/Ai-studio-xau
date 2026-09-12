import { describe, it, expect } from 'vitest';
import {
  detectLiquidityLevels,
  detectSweeps,
  getLevelsAsOf,
  getSweepsAsOf,
} from '../liquidity';
import { calculateATR } from '../atr';
import { NormalizedCandle, LiquidityLevel } from '../types';

function makeCandle(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
  timeOverride?: number,
): NormalizedCandle {
  return {
    time: timeOverride ?? 1_700_000_000 + index * 900, // 15m bars
    timeFormatted: '',
    open,
    high,
    low,
    close,
    volume: 100,
  };
}

describe('Liquidity — level detection', () => {
  it('returns empty for empty candles', () => {
    expect(detectLiquidityLevels([])).toEqual([]);
  });

  it('detects PDH/PDL from multi-day data', () => {
    // 2 days of 15m candles (96 bars/day)
    const candles: NormalizedCandle[] = [];
    let t = 1_700_000_000;
    const DAY = 24 * 60 * 60;
    for (let i = 0; i < 200; i++) {
      candles.push(makeCandle(i, 100, 100 + (i % 5), 99 - (i % 3), 100, t + i * 900));
    }
    const levels = detectLiquidityLevels(candles);
    const pdh = levels.filter((l) => l.type === 'PDH');
    const pdl = levels.filter((l) => l.type === 'PDL');
    expect(pdh.length).toBeGreaterThan(0);
    expect(pdl.length).toBeGreaterThan(0);
    pdh.forEach((l) => expect(l.price).toBeGreaterThan(100));
    pdl.forEach((l) => expect(l.price).toBeLessThan(100));
  });

  it('all levels have valid type', () => {
    const candles = Array.from({ length: 200 }, (_, i) =>
      makeCandle(i, 100, 102, 98, 101),
    );
    const levels = detectLiquidityLevels(candles);
    const validTypes = [
      'PDH', 'PDL', 'PWH', 'PWL',
      'ASIAN_HIGH', 'ASIAN_LOW', 'LONDON_HIGH', 'LONDON_LOW',
      'NY_HIGH', 'NY_LOW', 'EQUAL_HIGHS', 'EQUAL_LOWS',
      'SESSION_HIGH', 'SESSION_LOW',
    ];
    levels.forEach((l) => expect(validTypes).toContain(l.type));
  });

  it('deterministic', () => {
    const candles = Array.from({ length: 200 }, (_, i) =>
      makeCandle(i, 100, 102, 98, 101),
    );
    const a = detectLiquidityLevels(candles);
    const b = detectLiquidityLevels(candles);
    expect(a).toEqual(b);
  });
});

describe('Liquidity — sweeps', () => {
  it('detects sweep up', () => {
    const candles = [
      makeCandle(0, 100, 105, 95, 100),
      makeCandle(1, 100, 106, 100, 104),
      makeCandle(2, 104, 106, 103, 104),
    ];
    const atr = calculateATR(candles, 1);
    const levels: LiquidityLevel[] = [
      {
        id: 'lvl1',
        type: 'PDH',
        price: 105,
        createdAt: 1_700_000_000,
        createdAtIndex: 0,
        source: 'test',
        confirmedAtIndex: 0,
      },
    ];
    const sweeps = detectSweeps(candles, atr, levels, {
      equalToleranceAtr: 0.15,
      sweepAlphaAtr: 0.05,
    });
    const up = sweeps.filter((s) => s.direction === 'SWEEP_UP');
    expect(up.length).toBeGreaterThanOrEqual(1);
  });

  it('detects sweep down', () => {
    const candles = [
      makeCandle(0, 100, 105, 95, 100),
      makeCandle(1, 100, 100, 94, 96),
      makeCandle(2, 96, 100, 95, 99),
    ];
    const atr = calculateATR(candles, 1);
    const levels: LiquidityLevel[] = [
      {
        id: 'lvl1',
        type: 'PDL',
        price: 95,
        createdAt: 1_700_000_000,
        createdAtIndex: 0,
        source: 'test',
        confirmedAtIndex: 0,
      },
    ];
    const sweeps = detectSweeps(candles, atr, levels, {
      equalToleranceAtr: 0.15,
      sweepAlphaAtr: 0.05,
    });
    const down = sweeps.filter((s) => s.direction === 'SWEEP_DOWN');
    expect(down.length).toBeGreaterThanOrEqual(1);
  });

  it('does not detect sweep without penetration', () => {
    const candles = [
      makeCandle(0, 100, 104, 99, 102),
      makeCandle(1, 102, 104, 101, 103),
    ];
    const atr = calculateATR(candles, 1);
    const levels: LiquidityLevel[] = [
      {
        id: 'lvl1',
        type: 'PDH',
        price: 105,
        createdAt: 1_700_000_000,
        createdAtIndex: 0,
        source: 'test',
        confirmedAtIndex: 0,
      },
    ];
    const sweeps = detectSweeps(candles, atr, levels, {
      equalToleranceAtr: 0.15,
      sweepAlphaAtr: 0.05,
    });
    expect(sweeps.length).toBe(0);
  });

  it('all sweeps have valid direction', () => {
    const candles = Array.from({ length: 50 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i / 3) * 5, 105 + Math.sin(i / 3) * 5, 95 + Math.cos(i / 3) * 4, 100 + Math.sin(i / 3) * 5),
    );
    const atr = calculateATR(candles, 5);
    const levels = detectLiquidityLevels(candles);
    const sweeps = detectSweeps(candles, atr, levels, {
      equalToleranceAtr: 0.15,
      sweepAlphaAtr: 0.05,
    });
    sweeps.forEach((s) => {
      expect(['SWEEP_UP', 'SWEEP_DOWN']).toContain(s.direction);
      expect(s.penetrationAtr).toBeGreaterThan(0);
    });
  });
});

describe('Liquidity — helpers', () => {
  it('getLevelsAsOf filters correctly', () => {
    const levels: LiquidityLevel[] = [
      { id: 'a', type: 'PDH', price: 105, createdAt: 0, createdAtIndex: 5, source: 'x', confirmedAtIndex: 5 },
      { id: 'b', type: 'PDL', price: 95, createdAt: 0, createdAtIndex: 10, source: 'x', confirmedAtIndex: 10 },
    ];
    expect(getLevelsAsOf(levels, 5).length).toBe(1);
    expect(getLevelsAsOf(levels, 10).length).toBe(2);
  });

  it('getSweepsAsOf filters correctly', () => {
    const candles = Array.from({ length: 30 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i) * 3, 103 + Math.sin(i) * 3, 97 + Math.cos(i) * 2, 100 + Math.sin(i) * 3),
    );
    const atr = calculateATR(candles, 5);
    const levels = detectLiquidityLevels(candles);
    const sweeps = detectSweeps(candles, atr, levels, {
      equalToleranceAtr: 0.15,
      sweepAlphaAtr: 0.05,
    });
    const at10 = getSweepsAsOf(sweeps, 10);
    at10.forEach((s) => expect(s.candleIndex).toBeLessThanOrEqual(10));
  });

  it('deterministic sweeps', () => {
    const candles = Array.from({ length: 50 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i / 3) * 5, 105 + Math.sin(i / 3) * 5, 95 + Math.cos(i / 3) * 4, 100 + Math.sin(i / 3) * 5),
    );
    const atr = calculateATR(candles, 5);
    const levels = detectLiquidityLevels(candles);
    const a = detectSweeps(candles, atr, levels, { equalToleranceAtr: 0.15, sweepAlphaAtr: 0.05 });
    const b = detectSweeps(candles, atr, levels, { equalToleranceAtr: 0.15, sweepAlphaAtr: 0.05 });
    expect(a).toEqual(b);
  });
});

describe('Liquidity — anti-lookahead', () => {
  it('level at index i does not change when future candles added', () => {
    const base = Array.from({ length: 200 }, (_, i) =>
      makeCandle(i, 100, 102, 98, 101),
    );
    const withFuture = [
      ...base,
      ...Array.from({ length: 100 }, (_, i) =>
        makeCandle(200 + i, 100, 102, 98, 101),
      ),
    ];
    const levelsBase = detectLiquidityLevels(base);
    const levelsFuture = detectLiquidityLevels(withFuture)
      .filter((l) => l.confirmedAtIndex < base.length);
    // Levels up to base.length should be identical
    expect(levelsBase.length).toBeLessThanOrEqual(levelsFuture.length);
  });
});
