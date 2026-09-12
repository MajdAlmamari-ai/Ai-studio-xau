import { describe, it, expect } from 'vitest';
import {
  detectOrderBlocks,
  updateOBWithCandle,
  getOBsAsOf,
  getActiveOBs,
  isPriceInOB,
} from '../orderBlock';
import { detectBreaks } from '../breaks';
import { detectSwings } from '../swings';
import { calculateATR } from '../atr';
import {
  NormalizedCandle,
  OBDetectionConfig,
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
    time: 1_700_000_000 + index * 60,
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
const obConfig: OBDetectionConfig = {
  maxLookback: 5,
  minDisplacementAtr: 0.1,
  maxOriginRangeAtr: 5,
};

describe('OB — detection', () => {
  it('throws for invalid maxLookback', () => {
    const candles = [makeCandle(0, 100, 101, 99, 100)];
    expect(() =>
      detectOrderBlocks(candles, [], [], {
        ...obConfig,
        maxLookback: 0,
      }),
    ).toThrow();
  });

  it('throws for negative minDisplacementAtr', () => {
    const candles = [makeCandle(0, 100, 101, 99, 100)];
    expect(() =>
      detectOrderBlocks(candles, [], [], {
        ...obConfig,
        minDisplacementAtr: -1,
      }),
    ).toThrow();
  });

  it('returns empty when no breaks', () => {
    const candles = Array.from({ length: 10 }, (_, i) =>
      makeCandle(i, 100, 101, 99, 100),
    );
    const atr = calculateATR(candles, 3);
    const obs = detectOrderBlocks(candles, atr, [], obConfig);
    expect(obs).toEqual([]);
  });

  it('all OBs have valid direction', () => {
    const candles = Array.from({ length: 40 }, (_, i) =>
      makeCandle(
        i,
        100 + Math.sin(i / 3) * 5,
        102 + Math.sin(i / 3) * 5,
        98 + Math.cos(i / 3) * 4,
        100 + Math.sin(i / 3) * 5,
      ),
    );
    const atr = calculateATR(candles, 5);
    const swings = detectSwings(candles, swingConfig);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    const obs = detectOrderBlocks(candles, atr, breaks, obConfig);

    obs.forEach((ob) => {
      expect(['BULLISH', 'BEARISH']).toContain(ob.direction);
      expect(ob.bottom).toBeLessThan(ob.top);
    });
  });

  it('deterministic', () => {
    const candles = Array.from({ length: 40 }, (_, i) =>
      makeCandle(
        i,
        100 + Math.sin(i / 3) * 5,
        102 + Math.sin(i / 3) * 5,
        98 + Math.cos(i / 3) * 4,
        100 + Math.sin(i / 3) * 5,
      ),
    );
    const atr = calculateATR(candles, 5);
    const swings = detectSwings(candles, swingConfig);
    const breaks = detectBreaks(candles, swings, atr, breakConfig);
    const a = detectOrderBlocks(candles, atr, breaks, obConfig);
    const b = detectOrderBlocks(candles, atr, breaks, obConfig);
    expect(a).toEqual(b);
  });
});

const baseOb = {
  id: 'ob_bull_test',
  direction: 'BULLISH' as const,
  bottom: 100,
  top: 105,
  originIndex: 1,
  originTime: 1_700_000_060,
  breakIndex: 3,
  breakType: 'BOS_UP' as const,
  displacementAtr: 1.0,
  status: 'ACTIVE' as const,
  mitigationCount: 0,
  firstMitigationIndex: null,
  lastMitigationIndex: null,
  invalidationIndex: null,
  confirmedAtIndex: 3,
};

describe('OB — lifecycle', () => {

  it('does not update before breakIndex', () => {
    const updated = updateOBWithCandle(baseOb, makeCandle(2, 105, 106, 100, 101), 2);
    expect(updated).toEqual(baseOb);
  });

  it('marks MITIGATED on contact', () => {
    const updated = updateOBWithCandle(baseOb, makeCandle(4, 105, 106, 102, 103), 4);
    expect(updated.status).toBe('MITIGATED');
    expect(updated.mitigationCount).toBe(1);
    expect(updated.firstMitigationIndex).toBe(4);
  });

  it('does not double-count continuous contact', () => {
    const first = updateOBWithCandle(baseOb, makeCandle(4, 105, 106, 102, 103), 4);
    const second = updateOBWithCandle(first, makeCandle(5, 105, 106, 102, 103), 5);
    expect(second.mitigationCount).toBe(1);
  });

  it('INVALIDATES on close below bottom', () => {
    const updated = updateOBWithCandle(baseOb, makeCandle(4, 100, 101, 95, 96), 4);
    expect(updated.status).toBe('INVALIDATED');
    expect(updated.invalidationIndex).toBe(4);
  });

  it('does not mutate original', () => {
    const copy = { ...baseOb };
    updateOBWithCandle(baseOb, makeCandle(4, 105, 106, 102, 103), 4);
    expect(baseOb).toEqual(copy);
  });
});

describe('OB — helpers', () => {
  it('isPriceInOB works', () => {
    const ob = {
      id: 'x',
      direction: 'BULLISH' as const,
      bottom: 100,
      top: 105,
      originIndex: 1,
      originTime: 0,
      breakIndex: 2,
      breakType: 'BOS_UP' as const,
      displacementAtr: 1,
      status: 'ACTIVE' as const,
      mitigationCount: 0,
      firstMitigationIndex: null,
      lastMitigationIndex: null,
      invalidationIndex: null,
      confirmedAtIndex: 2,
    };
    expect(isPriceInOB(ob, 100)).toBe(true);
    expect(isPriceInOB(ob, 105)).toBe(true);
    expect(isPriceInOB(ob, 99)).toBe(false);
    expect(isPriceInOB(ob, 106)).toBe(false);
  });

  it('getOBsAsOf filters correctly', () => {
    const obs = [
      { ...baseOb, confirmedAtIndex: 3 },
      { ...baseOb, id: 'ob2', confirmedAtIndex: 5 },
    ];
    const at3 = getOBsAsOf(obs, 3);
    expect(at3.length).toBe(1);
    const at5 = getOBsAsOf(obs, 5);
    expect(at5.length).toBe(2);
  });

  it('getActiveOBs filters correctly', () => {
    const obs = [
      { ...baseOb, status: 'ACTIVE' as const },
      { ...baseOb, id: 'ob2', status: 'MITIGATED' as const },
    ];
    const active = getActiveOBs(obs);
    expect(active.length).toBe(1);
  });
});
