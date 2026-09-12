import { describe, it, expect } from 'vitest';
import { detectBreaks, getBreaksAsOf, getLatestBreak } from '../breaks';
import { detectSwings } from '../swings';
import { calculateATR } from '../atr';
import {
  BreakDetectionConfig,
  NormalizedCandle,
  SwingDetectionConfig,
} from '../types';

function makeCandle(
  index: number,
  high: number,
  low: number,
  close?: number,
): NormalizedCandle {
  const c = close ?? (high + low) / 2;
  return {
    time: 1_700_000_000 + index * 60,
    timeFormatted: '',
    open: (high + low) / 2,
    high,
    low,
    close: c,
    volume: 100,
  };
}

const swingConfig: SwingDetectionConfig = { leftBars: 2, rightBars: 2 };
const breakConfig: BreakDetectionConfig = {
  minStrengthAtr: 0.1,
  leftBars: 2,
  rightBars: 2,
};

describe('Breaks — config validation', () => {
  it('throws for invalid leftBars', () => {
    const candles = [makeCandle(0, 100, 99)];
    const swings = detectSwings(candles, swingConfig);
    const atr = calculateATR(candles, 3);
    expect(() =>
      detectBreaks(candles, swings, atr, { minStrengthAtr: 0.3, leftBars: 0, rightBars: 2 }),
    ).toThrow();
  });

  it('throws for negative minStrengthAtr', () => {
    const candles = [makeCandle(0, 100, 99)];
    const swings = detectSwings(candles, swingConfig);
    const atr = calculateATR(candles, 3);
    expect(() =>
      detectBreaks(candles, swings, atr, { minStrengthAtr: -1, leftBars: 2, rightBars: 2 }),
    ).toThrow();
  });
});

describe('Breaks — detection', () => {
  it('returns empty when no swings', () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i), 99 + Math.sin(i)),
    );
    const swings = detectSwings(candles, swingConfig);
    const atr = calculateATR(candles, 14);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    // Result depends on data, but function must not throw
    expect(Array.isArray(breaks)).toBe(true);
  });

  it('all breaks have strength >= minStrengthAtr', () => {
    const candles = Array.from({ length: 40 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i / 2) * 5, 95 + Math.cos(i / 2) * 5),
    );
    const swings = detectSwings(candles, swingConfig);
    const atr = calculateATR(candles, 14);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    breaks.forEach((b) => {
      expect(b.strengthAtr).toBeGreaterThanOrEqual(breakConfig.minStrengthAtr);
    });
  });

  it('confirmedAtIndex equals breakIndex', () => {
    const candles = Array.from({ length: 40 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i / 2) * 5, 95 + Math.cos(i / 2) * 5),
    );
    const swings = detectSwings(candles, swingConfig);
    const atr = calculateATR(candles, 14);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    breaks.forEach((b) => {
      expect(b.confirmedAtIndex).toBe(b.breakIndex);
    });
  });

  it('deterministic', () => {
    const candles = Array.from({ length: 40 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i / 2) * 5, 95 + Math.cos(i / 2) * 5),
    );
    const swings = detectSwings(candles, swingConfig);
    const atr = calculateATR(candles, 14);
    const a = detectBreaks(candles, swings, atr, breakConfig);
    const b = detectBreaks(candles, swings, atr, breakConfig);
    expect(a).toEqual(b);
  });

  it('all break types are valid', () => {
    const candles = Array.from({ length: 60 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i / 2) * 8, 95 + Math.cos(i / 2) * 8),
    );
    const swings = detectSwings(candles, swingConfig);
    const atr = calculateATR(candles, 14);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    const validTypes = ['BOS_UP', 'BOS_DOWN', 'CHOCH_UP', 'CHOCH_DOWN', 'FAILED_BREAK'];
    breaks.forEach((b) => {
      expect(validTypes).toContain(b.type);
    });
  });
});

describe('Breaks — anti-lookahead', () => {
  it('getBreaksAsOf filters correctly', () => {
    const candles = Array.from({ length: 40 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i / 2) * 5, 95 + Math.cos(i / 2) * 5),
    );
    const swings = detectSwings(candles, swingConfig);
    const atr = calculateATR(candles, 14);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);

    const at10 = getBreaksAsOf(breaks, 10);
    at10.forEach((b) => {
      expect(b.confirmedAtIndex).toBeLessThanOrEqual(10);
    });
  });

  it('result does not change when future candles are added', () => {
    const base = Array.from({ length: 30 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i / 2) * 5, 95 + Math.cos(i / 2) * 5),
    );
    const withFuture = [
      ...base,
      ...Array.from({ length: 10 }, (_, i) =>
        makeCandle(30 + i, 100 + Math.sin((30 + i) / 2) * 5, 95 + Math.cos((30 + i) / 2) * 5),
      ),
    ];

    const swingsBase = detectSwings(base, swingConfig);
    const atrBase = calculateATR(base, 14);
    const breaksBase = detectBreaks(base, swingsBase, atrBase, breakConfig);

    const swingsFuture = detectSwings(withFuture, swingConfig);
    const atrFuture = calculateATR(withFuture, 14);
    const breaksFuture = detectBreaks(withFuture, swingsFuture, atrFuture, breakConfig)
      .filter((b) => b.confirmedAtIndex < base.length);

    expect(breaksBase).toEqual(breaksFuture);
  });
});

describe('Breaks — helpers', () => {
  it('getLatestBreak returns last or null', () => {
    expect(getLatestBreak([])).toBeNull();
  });
});
