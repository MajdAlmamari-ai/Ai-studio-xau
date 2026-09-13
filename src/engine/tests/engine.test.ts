import { describe, it, expect } from 'vitest';
import {
  runRealSMCEngine,
  runLatestRealSMCEngine,
  getActiveFvgs,
  getActiveOBs,
} from '../engine';
import { NormalizedCandle, DEFAULT_ENGINE_CONFIG } from '../types';

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

function makeSeries(length: number): NormalizedCandle[] {
  return Array.from({ length }, (_, i) =>
    makeCandle(
      i,
      100 + Math.sin(i / 5) * 5,
      102 + Math.sin(i / 5) * 5,
      98 + Math.cos(i / 5) * 5,
      100 + Math.sin(i / 5) * 5,
    ),
  );
}

describe('Engine — validation', () => {
  it('throws for empty candles', () => {
    expect(() => runRealSMCEngine([])).toThrow();
  });

  it('throws for out-of-range asOfIndex', () => {
    const candles = makeSeries(100);
    expect(() => runRealSMCEngine(candles, 999)).toThrow();
    expect(() => runRealSMCEngine(candles, -1)).toThrow();
  });
});

describe('Engine — full pipeline', () => {
  it('returns all expected fields', () => {
    const candles = makeSeries(100);
    const result = runRealSMCEngine(candles);
    expect(result.asOfIndex).toBe(99);
    expect(result.currentPrice).toBeCloseTo(candles[99].close, 5);
    expect(result.asOfTime).toBe(candles[99].time);
    expect(Array.isArray(result.atr)).toBe(true);
    expect(Array.isArray(result.swings)).toBe(true);
    expect(Array.isArray(result.breaks)).toBe(true);
    expect(Array.isArray(result.fvgs)).toBe(true);
    expect(Array.isArray(result.orderBlocks)).toBe(true);
    expect(Array.isArray(result.levels)).toBe(true);
    expect(Array.isArray(result.sweeps)).toBe(true);
    expect(result.regime).toBeDefined();
    expect(result.confluence).toBeDefined();
    expect(result.reasonCodes).toBeInstanceOf(Array);
  });

  it('ATR length matches candles length', () => {
    const candles = makeSeries(100);
    const result = runRealSMCEngine(candles);
    expect(result.atr.length).toBe(100);
  });

  it('confluence score is 0-100', () => {
    const candles = makeSeries(100);
    const result = runRealSMCEngine(candles);
    expect(result.confluence.score).toBeGreaterThanOrEqual(0);
    expect(result.confluence.score).toBeLessThanOrEqual(100);
  });

  it('regime is a valid value', () => {
    const candles = makeSeries(100);
    const result = runRealSMCEngine(candles);
    const valid = [
      'TREND_UP', 'TREND_DOWN', 'RANGE',
      'NORMAL_VOLATILITY', 'HIGH_VOLATILITY',
      'LOW_LIQUIDITY', 'NEWS_RISK', 'UNKNOWN',
    ];
    expect(valid).toContain(result.regime.regime);
  });

  it('deterministic — same input gives same output', () => {
    const candles = makeSeries(100);
    const a = runRealSMCEngine(candles);
    const b = runRealSMCEngine(candles);
    expect(a.currentPrice).toBe(b.currentPrice);
    expect(a.confluence.score).toBe(b.confluence.score);
    expect(a.regime.regime).toBe(b.regime.regime);
    expect(a.swings).toEqual(b.swings);
    expect(a.breaks).toEqual(b.breaks);
  });

  it('asOfIndex default is last candle', () => {
    const candles = makeSeries(50);
    const result = runRealSMCEngine(candles);
    expect(result.asOfIndex).toBe(49);
  });

  it('asOfIndex=20 analyzes only first 21 candles', () => {
    const candles = makeSeries(100);
    const result = runRealSMCEngine(candles, 20);
    expect(result.asOfIndex).toBe(20);
    expect(result.atr.length).toBe(21);
  });
});

describe('Engine — anti-lookahead', () => {
  it('output at index 50 unchanged when future candles added', () => {
    const base = makeSeries(51);
    const withFuture = [...base, ...makeSeries(50).map((c, i) => ({
      ...c,
      time: 1_700_000_000 + (51 + i) * 900,
    }))];

    const a = runRealSMCEngine(base, 50);
    const b = runRealSMCEngine(withFuture, 50);

    expect(a.currentPrice).toBe(b.currentPrice);
    expect(a.confluence.score).toBe(b.confluence.score);
    expect(a.regime.regime).toBe(b.regime.regime);
    expect(a.swings).toEqual(b.swings);
    expect(a.breaks).toEqual(b.breaks);
  });
});

describe('Engine — helpers', () => {
  it('runLatestRealSMCEngine works', () => {
    const candles = makeSeries(100);
    const result = runLatestRealSMCEngine(candles);
    expect(result.asOfIndex).toBe(99);
  });

  it('runLatestRealSMCEngine throws for empty', () => {
    expect(() => runLatestRealSMCEngine([])).toThrow();
  });

  it('getActiveFvgs returns subset', () => {
    const candles = makeSeries(100);
    const result = runRealSMCEngine(candles);
    const active = getActiveFvgs(result);
    expect(active.length).toBeLessThanOrEqual(result.fvgs.length);
    active.forEach((z) => {
      expect(['ACTIVE', 'PARTIAL']).toContain(z.status);
    });
  });

  it('getActiveOBs returns subset', () => {
    const candles = makeSeries(100);
    const result = runRealSMCEngine(candles);
    const active = getActiveOBs(result);
    expect(active.length).toBeLessThanOrEqual(result.orderBlocks.length);
    active.forEach((o) => {
      expect(['ACTIVE', 'MITIGATED']).toContain(o.status);
    });
  });

  it('DEFAULT_ENGINE_CONFIG is valid', () => {
    expect(DEFAULT_ENGINE_CONFIG.atrPeriod).toBeGreaterThan(0);
    expect(DEFAULT_ENGINE_CONFIG.swingConfig).toBeDefined();
    expect(DEFAULT_ENGINE_CONFIG.breakConfig).toBeDefined();
    expect(DEFAULT_ENGINE_CONFIG.fvgConfig).toBeDefined();
    expect(DEFAULT_ENGINE_CONFIG.obConfig).toBeDefined();
    expect(DEFAULT_ENGINE_CONFIG.liquidityConfig).toBeDefined();
    expect(DEFAULT_ENGINE_CONFIG.regimeConfig).toBeDefined();
    expect(DEFAULT_ENGINE_CONFIG.confluenceConfig).toBeDefined();
  });
});
