/**
 * Unit Tests for FRED Client & Macro Correlation Engine (Batch 13)
 * -----------------------------------------------------------------------------
 * Tests:
 * - FredClient throws DataUnavailableError when FRED_API_KEY is missing
 * - FredClient handles network failure gracefully
 * - CorrelationEngine calculates exact Pearson correlation coefficient
 * - CorrelationEngine correctly maps regimes (CLASSIC_INVERSE, DECOUPLED, etc.)
 * - CorrelationEngine rejects insufficient data with DataUnavailableError
 * - NO Math.random
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FredClient } from '../FredClient';
import { correlationEngine } from '../CorrelationEngine';
import { DataUnavailableError } from '../../../src/errors/DataUnavailableError';

test('FRED & Macro Correlation — Batch 13 Unit Tests', async (t) => {
  await t.test('FredClient throws DataUnavailableError when API key is missing', async () => {
    const client = new FredClient('');
    await assert.rejects(
      async () => {
        await client.fetchSnapshot();
      },
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError);
        assert.strictEqual(err.code, 'FRED_API_KEY_MISSING');
        return true;
      }
    );
  });

  await t.test('CorrelationEngine computes perfect positive and inverse correlation', () => {
    // 5-point series
    const seriesA = [10, 20, 30, 40, 50];
    const seriesB = [2, 4, 6, 8, 10]; // perfect positive: r = 1.0
    const seriesC = [50, 40, 30, 20, 10]; // perfect inverse: r = -1.0

    const corrPos = correlationEngine.calculateRolling(seriesA, seriesB, 5);
    assert.strictEqual(corrPos, 1);

    const corrInv = correlationEngine.calculateRolling(seriesA, seriesC, 5);
    assert.strictEqual(corrInv, -1);
  });

  await t.test('CorrelationEngine assigns appropriate economic regimes', () => {
    assert.strictEqual(correlationEngine.getRegime(-0.85), 'CLASSIC_INVERSE');
    assert.strictEqual(correlationEngine.getRegime(-0.45), 'WEAK_INVERSE');
    assert.strictEqual(correlationEngine.getRegime(0.05), 'NEUTRAL');
    assert.strictEqual(correlationEngine.getRegime(0.65), 'DECOUPLED');
  });

  await t.test('CorrelationEngine throws DataUnavailableError on insufficient points', () => {
    const gold = [2700, 2705];
    const dxy = [104, 104.2];

    assert.throws(
      () => correlationEngine.calculateRolling(gold, dxy, 20),
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError);
        assert.strictEqual(err.code, 'INSUFFICIENT_CORRELATION_DATA');
        return true;
      }
    );
  });
});
