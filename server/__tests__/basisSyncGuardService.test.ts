/**
 * @file basisSyncGuardService.test.ts
 * @description اختبارات الوحدة لخدمة حماية ومزامنة الفارق السعري (BasisSyncGuard).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBasisAndSyncHealth, resetBasisGuardState } from '../basisSyncGuardService';

test('BasisSyncGuardService — Unit Tests', async (t) => {
  // Reset state before tests
  resetBasisGuardState(8.40);

  await t.test('Normal sync returns HEALTHY_SYNCED and correct basis', () => {
    const spot = 2700.0;
    const futures = 2708.5; // Basis = 8.50
    const metrics = resolveBasisAndSyncHealth(spot, futures);

    assert.strictEqual(metrics.healthState, 'HEALTHY_SYNCED');
    assert.strictEqual(metrics.effectiveBasis, 8.50);
    assert.strictEqual(metrics.isFuturesLive, true);
    assert.strictEqual(metrics.cautionMode, false);
  });

  await t.test('Futures disconnection (null/0) enters DEGRADED_FALLBACK and preserves last known valid basis', () => {
    // First establish valid basis
    resolveBasisAndSyncHealth(2700.0, 2708.5); // Effective basis = 8.50

    // Now futures disconnects
    const metricsNull = resolveBasisAndSyncHealth(2705.0, null);
    assert.strictEqual(metricsNull.healthState, 'DEGRADED_FALLBACK');
    assert.strictEqual(metricsNull.effectiveBasis, 8.50);
    assert.strictEqual(metricsNull.isFuturesLive, false);

    const metricsZero = resolveBasisAndSyncHealth(2705.0, 0);
    assert.strictEqual(metricsZero.healthState, 'DEGRADED_FALLBACK');
    assert.strictEqual(metricsZero.effectiveBasis, 8.50);
  });

  await t.test('High divergence (> 0.3%) triggers cautionMode and reduces position multiplier', () => {
    resetBasisGuardState(8.40);
    const spot = 2700.0;
    // Expected futures = 2700 + 8.40 = 2708.40. Let's pass futures = 2720.0 (divergence ~0.43% > 0.3%)
    const futures = 2720.0;
    const metrics = resolveBasisAndSyncHealth(spot, futures);

    assert.strictEqual(metrics.cautionMode, true);
    assert.strictEqual(metrics.positionSizeMultiplier, 0.5);
    assert.ok(metrics.divergencePct > 0.3);
  });
});
