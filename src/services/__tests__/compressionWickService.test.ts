/**
 * Unit Test for Task 1: compressionWickService (Spot XAUUSD)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { purifyCandleWick, calculateZoneTouchFreshness } from '../compressionWickService';

test('Task 1 — compressionWickService Unit Tests', async (t) => {
  await t.test('purifyCandleWick flags wicks exceeding 2.0 * ATR', () => {
    const resNormal = purifyCandleWick(2700, 2708, 2695, 2702, 5.0);
    assert.strictEqual(resNormal.isUpperWickValid, true);
    assert.strictEqual(resNormal.isLowerWickValid, true);

    const resExcessive = purifyCandleWick(2700, 2715, 2685, 2702, 5.0);
    assert.strictEqual(resExcessive.isUpperWickValid, false);
  });

  await t.test('calculateZoneTouchFreshness implements mitigation touch model correctly', () => {
    const freshZone = calculateZoneTouchFreshness('zone-1', 0);
    assert.strictEqual(freshZone.freshnessScore, 100);
    assert.strictEqual(freshZone.isConsumed, false);

    const testedZone = calculateZoneTouchFreshness('zone-1', 1);
    assert.strictEqual(testedZone.freshnessScore, 50);
    assert.strictEqual(testedZone.isConsumed, false);

    const consumedZone = calculateZoneTouchFreshness('zone-1', 2);
    assert.strictEqual(consumedZone.freshnessScore, 0);
    assert.strictEqual(consumedZone.isConsumed, true);
  });
});
