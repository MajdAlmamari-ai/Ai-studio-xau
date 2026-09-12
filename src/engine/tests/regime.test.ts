import { describe, it, expect } from 'vitest';
import { classifyRegime, classifyLatestRegime } from '../regime';
import { calculateATR } from '../atr';
import { detectSwings } from '../swings';
import { detectBreaks } from '../breaks';
import {
  NormalizedCandle,
  RegimeConfig,
  SwingDetectionConfig,
  BreakDetectionConfig,
} from '../types';

function makeCandle(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
): NormalizedCandle {
  return {
    time: 1_700_000_000 + index * 900,
    timeFormatted: '',
    open,
    high,
    low,
    close,
    volume: 100,
  };
}

const swingConfig: SwingDetectionConfig = { leftBars: 1, rightBars: 1 };
const breakConfig: BreakDetectionConfig = {
  minStrengthAtr: 0.05,
  leftBars: 1,
  rightBars: 1,
};
const regimeConfig: RegimeConfig = {
  minBars: 20,
  medianLookback: 50,
  highVolMultiplier: 1.5,
  lowVolMultiplier: 0.5,
  trendSwingLookback: 3,
};

describe('Regime — classification', () => {
  it('throws for out-of-range asOfIndex', () => {
    const candles = [makeCandle(0, 100, 101, 99, 100)];
    const atr = calculateATR(candles, 1);
    expect(() =>
      classifyRegime(candles, atr, [], [], 99, regimeConfig),
    ).toThrow();
  });

  it('returns UNKNOWN for insufficient bars', () => {
    const candles = Array.from({ length: 10 }, (_, i) =>
      makeCandle(i, 100 + i, 102 + i, 98 + i, 101 + i),
    );
    const atr = calculateATR(candles, 3);
    const swings = detectSwings(candles, swingConfig);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    const ctx = classifyRegime(candles, atr, swings, breaks, candles.length - 1, {
      ...regimeConfig,
      minBars: 100,
    });
    expect(ctx.regime).toBe('UNKNOWN');
    expect(ctx.reasonCodes).toContain('INSUFFICIENT_BARS');
  });

  it('returns a valid regime type', () => {
    const candles = Array.from({ length: 100 }, (_, i) =>
      makeCandle(
        i,
        100 + Math.sin(i / 5) * 5,
        102 + Math.sin(i / 5) * 5,
        98 + Math.cos(i / 5) * 5,
        100 + Math.sin(i / 5) * 5,
      ),
    );
    const atr = calculateATR(candles, 14);
    const swings = detectSwings(candles, swingConfig);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    const ctx = classifyRegime(
      candles,
      atr,
      swings,
      breaks,
      candles.length - 1,
      regimeConfig,
    );
    const validRegimes = [
      'TREND_UP',
      'TREND_DOWN',
      'RANGE',
      'NORMAL_VOLATILITY',
      'HIGH_VOLATILITY',
      'LOW_LIQUIDITY',
      'NEWS_RISK',
      'UNKNOWN',
    ];
    expect(validRegimes).toContain(ctx.regime);
  });

  it('detects HIGH_VOLATILITY when ATR spikes', () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 60; i++) {
      const range = i < 50 ? 0.3 : 6;
      candles.push(makeCandle(i, 100, 100 + range, 100 - range, 100));
    }
    const atr = calculateATR(candles, 5);
    const swings = detectSwings(candles, swingConfig);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    const ctx = classifyRegime(candles, atr, swings, breaks, 59, regimeConfig);
    expect(['HIGH_VOLATILITY', 'UNKNOWN']).toContain(ctx.regime);
  });

  it('detects LOW_LIQUIDITY when ATR shrinks', () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 60; i++) {
      const range = i < 50 ? 3 : 0.05;
      candles.push(makeCandle(i, 100, 100 + range, 100 - range, 100));
    }
    const atr = calculateATR(candles, 5);
    const swings = detectSwings(candles, swingConfig);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    const ctx = classifyRegime(candles, atr, swings, breaks, 59, regimeConfig);
    expect(['LOW_LIQUIDITY', 'UNKNOWN']).toContain(ctx.regime);
  });

  it('deterministic', () => {
    const candles = Array.from({ length: 100 }, (_, i) =>
      makeCandle(
        i,
        100 + Math.sin(i / 5) * 5,
        102 + Math.sin(i / 5) * 5,
        98 + Math.cos(i / 5) * 5,
        100 + Math.sin(i / 5) * 5,
      ),
    );
    const atr = calculateATR(candles, 14);
    const swings = detectSwings(candles, swingConfig);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    const a = classifyRegime(candles, atr, swings, breaks, 99, regimeConfig);
    const b = classifyRegime(candles, atr, swings, breaks, 99, regimeConfig);
    expect(a).toEqual(b);
  });
});

describe('Regime — anti-lookahead', () => {
  it('regime at index i unchanged when future candles added', () => {
    const base = Array.from({ length: 60 }, (_, i) =>
      makeCandle(
        i,
        100 + Math.sin(i / 5) * 5,
        102 + Math.sin(i / 5) * 5,
        98 + Math.cos(i / 5) * 5,
        100 + Math.sin(i / 5) * 5,
      ),
    );
    const withFuture = [
      ...base,
      ...Array.from({ length: 40 }, (_, i) =>
        makeCandle(
          60 + i,
          100 + Math.sin((60 + i) / 5) * 5,
          102 + Math.sin((60 + i) / 5) * 5,
          98 + Math.cos((60 + i) / 5) * 5,
          100 + Math.sin((60 + i) / 5) * 5,
        ),
      ),
    ];
    const atr1 = calculateATR(base, 14);
    const atr2 = calculateATR(withFuture, 14);
    const sw1 = detectSwings(base, swingConfig);
    const sw2 = detectSwings(withFuture, swingConfig);
    const br1 = detectBreaks(base, sw1, atr1, breakConfig);
    const br2 = detectBreaks(withFuture, sw2, atr2, breakConfig);

    const a = classifyRegime(base, atr1, sw1, br1, base.length - 1, regimeConfig);
    const b = classifyRegime(
      withFuture,
      atr2,
      sw2,
      br2,
      base.length - 1,
      regimeConfig,
    );
    expect(a.regime).toBe(b.regime);
  });
});

describe('Regime — helpers', () => {
  it('classifyLatestRegime works on non-empty', () => {
    const candles = Array.from({ length: 100 }, (_, i) =>
      makeCandle(
        i,
        100 + Math.sin(i / 5) * 5,
        102 + Math.sin(i / 5) * 5,
        98 + Math.cos(i / 5) * 5,
        100 + Math.sin(i / 5) * 5,
      ),
    );
    const atr = calculateATR(candles, 14);
    const swings = detectSwings(candles, swingConfig);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    const ctx = classifyLatestRegime(candles, atr, swings, breaks, regimeConfig);
    expect(ctx.regime).toBeDefined();
  });

  it('classifyLatestRegime throws for empty candles', () => {
    expect(() => classifyLatestRegime([], [], [], [], regimeConfig)).toThrow();
  });
});
