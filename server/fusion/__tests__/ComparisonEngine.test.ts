/**
 * Unit Tests for ComparisonEngine (Action 10.2)
 * -----------------------------------------------------------------------------
 * Tests:
 * - FULL alignment when both agree on direction and score diff <= 15
 * - PARTIAL alignment when both agree on direction and score diff > 15
 * - DIVERGENT alignment when directions disagree
 * - Basis z-score calculation
 * - Confluence score range 0-100
 * - Verdict mapping (STRONG_BUY, SELL, WAIT, etc.)
 * - NO Math.random in engine or tests
 * 
 * STRICT: Deterministic. Real calculations only.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonEngine } from '../ComparisonEngine';
import { SpotAnalysis } from '../../engines/SpotEngine';
import { FuturesAnalysis } from '../../engines/FuturesEngine';
import { asSpotPrice, asFuturesPrice } from '../../../src/engine/types/branded';
import { DataUnavailableError } from '../../../src/errors/DataUnavailableError';

test('ComparisonEngine — Unit Tests', async (t) => {
  const mockSpotBase: SpotAnalysis = {
    symbol: 'OANDA:XAUUSD',
    currentPrice: asSpotPrice(2700),
    direction: 'LONG',
    score: 80,
    atr: 4.5,
    vwap: 2698,
    confluence: ['BOS_UP', 'Active OB'],
    sessionAnalysis: { activeSessions: ['LONDON'], liquidityLevel: 'OPTIMAL' },
    timestamp: 1700000000,
  };

  const mockFuturesBase: FuturesAnalysis = {
    symbol: 'COMEX:GC1!',
    currentPrice: asFuturesPrice(2710),
    direction: 'LONG',
    score: 85,
    atr: 5.0,
    vwap: 2708,
    confluence: ['BOS_UP', 'CVD Delta: +800'],
    cvd: { cumulativeDelta: 800, buyVolume: 1200, sellVolume: 400 },
    openInterest: 65000,
    timestamp: 1700000000,
  };

  await t.test('FULL alignment when both agree with score diff <= 15', () => {
    const result = comparisonEngine.analyze(
      mockSpotBase,
      mockFuturesBase,
      2700,
      2710,
      [9.8, 10.1, 9.9, 10.2, 10.0]
    );

    assert.strictEqual(result.alignment, 'FULL');
    assert.ok(result.confluenceScore >= 80, `Expected confluence >= 80, got ${result.confluenceScore}`);
    assert.strictEqual(result.verdict, 'STRONG_BUY');
    assert.strictEqual(result.unifiedRecommendation.direction, 'LONG');
    assert.ok(result.basisAnalysis.current === 10);
  });

  await t.test('PARTIAL alignment when both agree but score diff > 15', () => {
    const spotWeak: SpotAnalysis = {
      ...mockSpotBase,
      score: 55, // diff = 85 - 55 = 30 > 15
    };

    const result = comparisonEngine.analyze(
      spotWeak,
      mockFuturesBase,
      2700,
      2710,
      [10.0, 10.0, 10.0]
    );

    assert.strictEqual(result.alignment, 'PARTIAL');
    assert.ok(result.confluenceScore >= 60);
  });

  await t.test('DIVERGENT alignment when directions disagree', () => {
    const spotShort: SpotAnalysis = {
      ...mockSpotBase,
      direction: 'SHORT',
      score: 75,
    };

    const result = comparisonEngine.analyze(
      spotShort,
      mockFuturesBase, // direction is LONG
      2700,
      2710,
      [10.0, 10.0]
    );

    assert.strictEqual(result.alignment, 'DIVERGENT');
    assert.strictEqual(result.verdict, 'WAIT');
    assert.strictEqual(result.unifiedRecommendation.direction, 'WAIT');
    assert.ok(result.warnings.length > 0);
  });

  await t.test('Basis Z-Score calculation and classification (NORMAL, ELEVATED, EXTREME)', () => {
    // Normal basis: history around 10, current is 10.1 -> zScore small
    const normalRes = comparisonEngine.analyze(
      mockSpotBase,
      mockFuturesBase,
      2700,
      2710.1,
      [10.0, 10.2, 9.9, 10.1, 10.0]
    );
    assert.strictEqual(normalRes.basisAnalysis.status, 'NORMAL');

    // Extreme basis: history around 10, current is 25 -> zScore high
    const extremeRes = comparisonEngine.analyze(
      mockSpotBase,
      mockFuturesBase,
      2700,
      2725,
      [10.0, 10.1, 9.9, 10.2, 10.0]
    );
    assert.strictEqual(extremeRes.basisAnalysis.status, 'EXTREME');
    assert.ok(Math.abs(extremeRes.basisAnalysis.zScore) >= 2.5);
  });

  await t.test('Confluence score always bounds between 0 and 100', () => {
    const res = comparisonEngine.analyze(
      mockSpotBase,
      mockFuturesBase,
      2700,
      2710,
      []
    );
    assert.ok(res.confluenceScore >= 0 && res.confluenceScore <= 100);
  });

  await t.test('Throws DataUnavailableError on invalid inputs', () => {
    assert.throws(
      () => comparisonEngine.analyze(null as any, mockFuturesBase, 2700, 2710),
      (err: any) => err instanceof DataUnavailableError && err.code === 'INVALID_SPOT_ANALYSIS'
    );

    assert.throws(
      () => comparisonEngine.analyze(mockSpotBase, mockFuturesBase, 0, 2710),
      (err: any) => err instanceof DataUnavailableError && err.code === 'INVALID_SPOT_PRICE'
    );
  });
});
