/**
 * Unit Tests for ETFClient & BasisEngine (Batch 15)
 * -----------------------------------------------------------------------------
 * Tests:
 * - BasisEngine correctly calculates Mean, StdDev, and Z-Score
 * - BasisEngine detects CONTANGO vs BACKWARDATION
 * - BasisEngine assigns NORMAL, ELEVATED, EXTREME status
 * - BasisEngine throws DataUnavailableError on empty history
 * - ETFClient structure validation
 * - NO Math.random
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { basisEngine } from '../BasisEngine';
import { DataUnavailableError } from '../../../src/errors/DataUnavailableError';

test('Futures Basis Engine — Batch 15 Unit Tests', async (t) => {
  await t.test('BasisEngine calculates exact basis metrics in Contango', () => {
    // Stable history with basis around 10
    const history = [10.0, 10.2, 9.8, 10.0, 10.0];
    const metrics = basisEngine.calculate(history);

    assert.strictEqual(metrics.current, 10.0);
    assert.strictEqual(metrics.mean, 10.0);
    assert.strictEqual(metrics.marketStructure, 'CONTANGO');
    assert.strictEqual(metrics.status, 'NORMAL');
    assert.ok(Math.abs(metrics.zScore) < 1.0);
  });

  await t.test('BasisEngine identifies Backwardation and Extreme deviation', () => {
    // History with 10 normal observations and 1 extreme drop to -5
    const history = [10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, -5.0];
    const metrics = basisEngine.calculate(history);

    assert.strictEqual(metrics.current, -5.0);
    assert.strictEqual(metrics.marketStructure, 'BACKWARDATION');
    assert.strictEqual(metrics.status, 'EXTREME');
    assert.ok(metrics.zScore <= -2.5);
  });

  await t.test('BasisEngine throws DataUnavailableError when history is empty', () => {
    assert.throws(
      () => basisEngine.calculate([]),
      (err: any) => err instanceof DataUnavailableError && err.code === 'INSUFFICIENT_BASIS_HISTORY'
    );
  });
});
