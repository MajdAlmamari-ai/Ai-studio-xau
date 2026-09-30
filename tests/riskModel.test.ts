/**
 * Unit Tests for Batch A4 — Risk Model
 * -----------------------------------------------------------------------------
 * Tests:
 * - PositionSizer: calculation, validation, slDistance = 0 throws DataUnavailableError
 * - RiskGuard: checkDaily normal vs exceeded loss percentage
 * - CircuitBreaker: 3 consecutive losses, weekly loss breach, normal operation
 *
 * Deterministic. Zero fake data.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { positionSizer, RiskConfig } from '../server/risk/PositionSizer';
import { riskGuard } from '../server/risk/RiskGuard';
import { circuitBreaker } from '../server/risk/CircuitBreaker';
import { DataUnavailableError } from '../src/errors/DataUnavailableError';

test('Batch A4 — Risk Model Unit Tests', async (t) => {
  const sampleConfig: RiskConfig = {
    accountSize: 50000,
    riskPerTrade: 0.01,   // 1% = $500 risk
    maxDailyLoss: 0.03,   // 3% max daily
    maxWeeklyLoss: 0.06,  // 6% max weekly
  };

  await t.test('A4.1: PositionSizer computes exact lots and enforces positive SL distance', () => {
    // Entry: 2750, SL: 2745 (slDistance = 5, pipValue = 100). Risk = 500. Lots = 500 / 500 = 1.00
    const size = positionSizer.calculate(sampleConfig, 2750, 2745, 100);
    assert.strictEqual(size.valid, true);
    assert.strictEqual(size.riskAmount, 500);
    assert.strictEqual(size.slDistance, 5);
    assert.strictEqual(size.lotSize, 1.00);

    // SL distance zero throws DataUnavailableError
    assert.throws(
      () => positionSizer.calculate(sampleConfig, 2750, 2750, 100),
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError);
        assert.strictEqual(err.code, 'INVALID_SL');
        return true;
      }
    );
  });

  await t.test('A4.2: RiskGuard detects normal balance vs daily loss breach', () => {
    // Normal case: Start 50,000, current 49,500 (1% loss, below 3% max)
    const normalState = riskGuard.checkDaily(sampleConfig, 50000, 49500);
    assert.strictEqual(normalState.tradingAllowed, true);
    assert.strictEqual(normalState.dailyLossPct, 0.01);
    assert.strictEqual(normalState.reasonAr, undefined);

    // Exceeded case: Start 50,000, current 48,000 (4% loss, above 3% max)
    const breachedState = riskGuard.checkDaily(sampleConfig, 50000, 48000);
    assert.strictEqual(breachedState.tradingAllowed, false);
    assert.strictEqual(breachedState.dailyLossPct, 0.04);
    assert.strictEqual(breachedState.reasonAr, 'تم تجاوز الحد اليومي للخسارة');
  });

  await t.test('A4.3: CircuitBreaker triggers on 3 consecutive losses or weekly loss limit', () => {
    // Normal state
    const normal = circuitBreaker.check(1, 0.02, sampleConfig);
    assert.strictEqual(normal.active, false);
    assert.strictEqual(normal.canRecover, true);

    // 3 consecutive losses
    const lossStreak = circuitBreaker.check(3, 0.02, sampleConfig);
    assert.strictEqual(lossStreak.active, true);
    assert.strictEqual(lossStreak.reasonAr, '3 خسائر متتالية');
    assert.strictEqual(lossStreak.canRecover, false);

    // Weekly loss exceeded (7% > 6%)
    const weeklyBreach = circuitBreaker.check(1, 0.07, sampleConfig);
    assert.strictEqual(weeklyBreach.active, true);
    assert.strictEqual(weeklyBreach.reasonAr, 'تم تجاوز الحد الأسبوعي');
    assert.strictEqual(weeklyBreach.canRecover, false);
  });
});
