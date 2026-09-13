import { describe, it, expect } from 'vitest';
import {
  calculateConfluence,
  calculateLatestConfluence,
} from '../confluence';
import { calculateATR } from '../atr';
import { detectSwings } from '../swings';
import { detectBreaks } from '../breaks';
import { detectFVGs } from '../fvg';
import { detectOrderBlocks } from '../orderBlock';
import { detectLiquidityLevels, detectSweeps } from '../liquidity';
import { classifyRegime } from '../regime';
import {
  NormalizedCandle,
  SwingDetectionConfig,
  BreakDetectionConfig,
  FVGDetectionConfig,
  OBDetectionConfig,
  LiquidityDetectionConfig,
  RegimeConfig,
  ConfluenceConfig,
  ConfluenceResult,
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
const fvgConfig: FVGDetectionConfig = { minGapAtrRatio: 0.05 };
const obConfig: OBDetectionConfig = {
  maxLookback: 5,
  minDisplacementAtr: 0.1,
  maxOriginRangeAtr: 5,
};
const liqConfig: LiquidityDetectionConfig = {
  equalToleranceAtr: 0.15,
  sweepAlphaAtr: 0.05,
};
const regimeConfig: RegimeConfig = {
  minBars: 20,
  medianLookback: 50,
  highVolMultiplier: 1.5,
  lowVolMultiplier: 0.5,
  trendSwingLookback: 3,
};
const confConfig: ConfluenceConfig = {
  minEligibleScore: 60,
  proximityAtr: 2.0,
  sweepRecencyBars: 10,
  weightStructure: 25,
  weightRegime: 20,
  weightFvg: 15,
  weightOb: 15,
  weightSweep: 15,
  weightDiscount: 10,
};

function buildFullScenario(candles: NormalizedCandle[]) {
  const atr = calculateATR(candles, 5);
  const swings = detectSwings(candles, swingConfig);
  const breaks = detectBreaks(candles, swings, atr, breakConfig);
  const fvgs = detectFVGs(candles, atr, fvgConfig);
  const obs = detectOrderBlocks(candles, atr, breaks, obConfig);
  const levels = detectLiquidityLevels(candles);
  const sweeps = detectSweeps(candles, atr, levels, liqConfig);
  const regime = classifyRegime(candles, atr, swings, breaks, candles.length - 1, regimeConfig);
  return { atr, swings, breaks, fvgs, obs, sweeps, regime };
}

describe('Confluence — validation', () => {
  it('throws for out-of-range asOfIndex', () => {
    const candles = [makeCandle(0, 100, 101, 99, 100)];
    const atr = calculateATR(candles, 1);
    const regime = classifyRegime(candles, atr, [], [], 0, regimeConfig);
    expect(() =>
      calculateConfluence(candles, atr, [], [], [], [], [], regime, 99, confConfig),
    ).toThrow();
  });

  it('throws for empty candles in latest', () => {
    const atr: (number | null)[] = [];
    const regime = {
      regime: 'UNKNOWN' as const,
      classifiedAtIndex: 0,
      atrCurrent: null,
      atrMedian: null,
      atrRatio: null,
      barsUsed: 0,
      reasonCodes: [],
    };
    expect(() =>
      calculateLatestConfluence([], atr, [], [], [], [], [], regime, confConfig),
    ).toThrow();
  });
});

describe('Confluence — scoring', () => {
  it('score is 0-100', () => {
    const candles = Array.from({ length: 100 }, (_, i) =>
      makeCandle(
        i,
        100 + Math.sin(i / 5) * 5,
        102 + Math.sin(i / 5) * 5,
        98 + Math.cos(i / 5) * 5,
        100 + Math.sin(i / 5) * 5,
      ),
    );
    const { atr, swings, breaks, fvgs, obs, sweeps, regime } = buildFullScenario(candles);
    const result = calculateConfluence(
      candles, atr, swings, breaks, fvgs, obs, sweeps, regime,
      candles.length - 1, confConfig,
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns all expected fields', () => {
    const candles = Array.from({ length: 100 }, (_, i) =>
      makeCandle(
        i,
        100 + Math.sin(i / 5) * 5,
        102 + Math.sin(i / 5) * 5,
        98 + Math.cos(i / 5) * 5,
        100 + Math.sin(i / 5) * 5,
      ),
    );
    const { atr, swings, breaks, fvgs, obs, sweeps, regime } = buildFullScenario(candles);
    const result = calculateConfluence(
      candles, atr, swings, breaks, fvgs, obs, sweeps, regime,
      candles.length - 1, confConfig,
    );
    expect(result.features).toBeDefined();
    expect(result.features.structureAligned).toBeDefined();
    expect(result.features.regimeTrending).toBeDefined();
    expect(result.features.fvgNearby).toBeDefined();
    expect(result.features.obNearby).toBeDefined();
    expect(result.features.liquiditySweepRecent).toBeDefined();
    expect(result.reasonCodes).toBeInstanceOf(Array);
    expect(typeof result.eligible).toBe('boolean');
  });

  it('eligible is true when score >= minEligibleScore', () => {
    const candles = Array.from({ length: 100 }, (_, i) =>
      makeCandle(
        i,
        100 + Math.sin(i / 5) * 5,
        102 + Math.sin(i / 5) * 5,
        98 + Math.cos(i / 5) * 5,
        100 + Math.sin(i / 5) * 5,
      ),
    );
    const { atr, swings, breaks, fvgs, obs, sweeps, regime } = buildFullScenario(candles);
    const result = calculateConfluence(
      candles, atr, swings, breaks, fvgs, obs, sweeps, regime,
      candles.length - 1, confConfig,
    );
    if (result.score >= confConfig.minEligibleScore) {
      expect(result.eligible).toBe(true);
    } else {
      expect(result.eligible).toBe(false);
    }
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
    const { atr, swings, breaks, fvgs, obs, sweeps, regime } = buildFullScenario(candles);
    const a = calculateConfluence(
      candles, atr, swings, breaks, fvgs, obs, sweeps, regime,
      candles.length - 1, confConfig,
    );
    const b = calculateConfluence(
      candles, atr, swings, breaks, fvgs, obs, sweeps, regime,
      candles.length - 1, confConfig,
    );
    expect(a).toEqual(b);
  });
});

describe('Confluence — anti-lookahead', () => {
  it('confluence at index i unchanged when future candles added', () => {
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

    const scenarioA = buildFullScenario(base);
    const scenarioB = buildFullScenario(withFuture);

    const a = calculateConfluence(
      base,
      scenarioA.atr,
      scenarioA.swings,
      scenarioA.breaks,
      scenarioA.fvgs,
      scenarioA.obs,
      scenarioA.sweeps,
      scenarioA.regime,
      base.length - 1,
      confConfig,
    );
    const b = calculateConfluence(
      withFuture,
      scenarioB.atr,
      scenarioB.swings,
      scenarioB.breaks,
      scenarioB.fvgs,
      scenarioB.obs,
      scenarioB.sweeps,
      scenarioB.regime,
      base.length - 1,
      confConfig,
    );
    expect(a.score).toBe(b.score);
  });
});

describe('Confluence — helpers', () => {
  it('calculateLatestConfluence works', () => {
    const candles = Array.from({ length: 100 }, (_, i) =>
      makeCandle(
        i,
        100 + Math.sin(i / 5) * 5,
        102 + Math.sin(i / 5) * 5,
        98 + Math.cos(i / 5) * 5,
        100 + Math.sin(i / 5) * 5,
      ),
    );
    const { atr, swings, breaks, fvgs, obs, sweeps, regime } = buildFullScenario(candles);
    const result = calculateLatestConfluence(
      candles, atr, swings, breaks, fvgs, obs, sweeps, regime, confConfig,
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
