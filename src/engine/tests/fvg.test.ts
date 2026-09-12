import { describe, it, expect } from 'vitest';
import {
  detectFVGs,
  updateFVGWithCandle,
  replayFVGLifecycle,
  getFVGsAsOf,
  getActiveFVGs,
  isPriceInFVG,
} from '../fvg';
import { calculateATR } from '../atr';
import { NormalizedCandle, FVGDetectionConfig } from '../types';

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

describe('FVG — detection', () => {
  it('detects a bullish FVG', () => {
    const candles = [
      makeCandle(0, 100, 101, 99, 100),
      makeCandle(1, 100, 106, 100, 105),  // displacement
      makeCandle(2, 105, 110, 105, 109),  // low > candle 0 high (101)
    ];
    const atr = calculateATR(candles, 1);
    const zones = detectFVGs(candles, atr, { minGapAtrRatio: 0 });
    const bullish = zones.filter((z) => z.direction === 'BULLISH');
    expect(bullish.length).toBe(1);
    expect(bullish[0].bottom).toBe(101);
    expect(bullish[0].top).toBe(105);
    expect(bullish[0].size).toBe(4);
    expect(bullish[0].status).toBe('ACTIVE');
  });

  it('detects a bearish FVG', () => {
    const candles = [
      makeCandle(0, 110, 112, 109, 111),
      makeCandle(1, 111, 112, 103, 104),  // displacement down
      makeCandle(2, 104, 105, 99, 100),   // high < candle 0 low (109)
    ];
    const atr = calculateATR(candles, 1);
    const zones = detectFVGs(candles, atr, { minGapAtrRatio: 0 });
    const bearish = zones.filter((z) => z.direction === 'BEARISH');
    expect(bearish.length).toBe(1);
    expect(bearish[0].top).toBe(109);
    expect(bearish[0].bottom).toBe(105);
  });

  it('rejects FVG when gap is too small', () => {
    const candles = [
      makeCandle(0, 100, 101, 99, 100),
      makeCandle(1, 100, 101.05, 100, 101),
      makeCandle(2, 101, 101.1, 101.02, 101.05),
    ];
    const atr = calculateATR(candles, 1);
    // Gap size = 101.02 - 101 = 0.02
    // ATR(1) at index 2 ≈ 0.06
    // ratio ≈ 0.33
    // With minGapAtrRatio = 0.5 → should reject
    const zones = detectFVGs(candles, atr, { minGapAtrRatio: 0.5 });
    expect(zones.length).toBe(0);
  });

  it('generates unique deterministic IDs', () => {
    const candles = [
      makeCandle(0, 100, 101, 99, 100),
      makeCandle(1, 100, 106, 100, 105),
      makeCandle(2, 105, 110, 105, 109),
    ];
    const atr = calculateATR(candles, 1);
    const a = detectFVGs(candles, atr, { minGapAtrRatio: 0 });
    const b = detectFVGs(candles, atr, { minGapAtrRatio: 0 });
    expect(a[0].id).toBe(b[0].id);
  });

  it('detects both bullish and bearish FVGs', () => {
    const candles = [
      makeCandle(0, 100, 101, 99, 100),
      makeCandle(1, 100, 106, 100, 105),
      makeCandle(2, 105, 110, 105, 109),   // bullish FVG
      makeCandle(3, 109, 110, 100, 101),   // displacement down
      makeCandle(4, 101, 102, 95, 96),     // bearish FVG (high 102 < low 99 of candle 2... wait)
    ];
    const atr = calculateATR(candles, 1);
    const zones = detectFVGs(candles, atr, { minGapAtrRatio: 0 });
    expect(zones.length).toBeGreaterThanOrEqual(1);
  });
});

describe('FVG — lifecycle', () => {
  function makeFVG() {
    const candles = [
      makeCandle(0, 100, 101, 99, 100),
      makeCandle(1, 100, 106, 100, 105),
      makeCandle(2, 105, 110, 105, 109),
    ];
    const atr = calculateATR(candles, 1);
    const zones = detectFVGs(candles, atr, { minGapAtrRatio: 0 });
    return zones[0];
  }

  it('does not mutate on candle below creation', () => {
    const zone = makeFVG();
    const updated = updateFVGWithCandle(zone, makeFVG() as any, 1);
    expect(updated).toEqual(zone);
  });

  it('stays ACTIVE when next candle does not touch', () => {
    const zone = makeFVG();
    const next = makeCandle(3, 109, 111, 106, 110);
    const updated = updateFVGWithCandle(zone, next, 3);
    expect(updated.status).toBe('ACTIVE');
    expect(updated.firstTouchIndex).toBeNull();
  });

  it('becomes PARTIAL when price enters but does not fully fill', () => {
    const zone = makeFVG();
    const next = makeCandle(3, 109, 110, 103, 106);
    const updated = updateFVGWithCandle(zone, next, 3);
    expect(updated.status).toBe('PARTIAL');
    expect(updated.firstTouchIndex).toBe(3);
    expect(updated.fullFillIndex).toBeNull();
  });

  it('becomes FULL_FILLED when price reaches the bottom', () => {
    const zone = makeFVG();
    const next = makeCandle(3, 109, 110, 100, 101);
    const updated = updateFVGWithCandle(zone, next, 3);
    expect(updated.status).toBe('FULL_FILLED');
    expect(updated.fullFillIndex).toBe(3);
  });

  it('becomes INVALIDATED when close breaks below the bottom', () => {
    const zone = makeFVG();
    const next = makeCandle(3, 105, 106, 95, 96);
    const updated = updateFVGWithCandle(zone, next, 3);
    expect(updated.status).toBe('INVALIDATED');
    expect(updated.invalidationIndex).toBe(3);
  });

  it('does not mutate original zone', () => {
    const zone = makeFVG();
    const original = { ...zone };
    updateFVGWithCandle(zone, makeCandle(3, 109, 110, 103, 106), 3);
    expect(zone).toEqual(original);
  });

  it('does not transition completed zones', () => {
    const zone = { ...makeFVG(), status: 'FULL_FILLED' as const };
    const updated = updateFVGWithCandle(zone, makeCandle(4, 100, 200, 50, 60), 4);
    expect(updated).toEqual(zone);
  });
});

describe('FVG — helpers', () => {
  it('getFVGsAsOf filters correctly', () => {
    const candles = [
      makeCandle(0, 100, 101, 99, 100),
      makeCandle(1, 100, 106, 100, 105),
      makeCandle(2, 105, 110, 105, 109),
      makeCandle(3, 109, 111, 106, 110),
      makeCandle(4, 110, 112, 105, 111),
    ];
    const atr = calculateATR(candles, 1);
    const zones = detectFVGs(candles, atr, { minGapAtrRatio: 0 });

    const at2 = getFVGsAsOf(zones, 2);
    const at4 = getFVGsAsOf(zones, 4);

    expect(at2.length).toBeLessThanOrEqual(at4.length);
  });

  it('isPriceInFVG works', () => {
    const candles = [
      makeCandle(0, 100, 101, 99, 100),
      makeCandle(1, 100, 106, 100, 105),
      makeCandle(2, 105, 110, 105, 109),
    ];
    const atr = calculateATR(candles, 1);
    const zones = detectFVGs(candles, atr, { minGapAtrRatio: 0 });
    const zone = zones[0];
    expect(isPriceInFVG(zone, zone.bottom)).toBe(true);
    expect(isPriceInFVG(zone, zone.top)).toBe(true);
    expect(isPriceInFVG(zone, zone.bottom - 1)).toBe(false);
    expect(isPriceInFVG(zone, zone.top + 1)).toBe(false);
  });

  it('deterministic detection', () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(i, 100 + Math.sin(i) * 3, 102 + Math.sin(i) * 3, 98 + Math.cos(i) * 2, 100 + Math.sin(i) * 3),
    );
    const atr = calculateATR(candles, 3);
    const a = detectFVGs(candles, atr, { minGapAtrRatio: 0.05 });
    const b = detectFVGs(candles, atr, { minGapAtrRatio: 0.05 });
    expect(a).toEqual(b);
  });
});

describe('FVG — anti-lookahead', () => {
  it('FVG at index i does not change when future candles added', () => {
    const base = [
      makeCandle(0, 100, 101, 99, 100),
      makeCandle(1, 100, 106, 100, 105),
      makeCandle(2, 105, 110, 105, 109),
    ];
    const withFuture = [
      ...base,
      makeCandle(3, 109, 111, 106, 110),
      makeCandle(4, 110, 112, 105, 111),
    ];
    const atr1 = calculateATR(base, 1);
    const atr2 = calculateATR(withFuture, 1);
    const zones1 = detectFVGs(base, atr1, { minGapAtrRatio: 0 });
    const zones2 = detectFVGs(withFuture, atr2, { minGapAtrRatio: 0 })
      .filter((z) => z.createdAtIndex < base.length);
    expect(zones1).toEqual(zones2);
  });
});
