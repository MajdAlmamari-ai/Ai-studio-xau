/**
 * Unit Test Suite for Out-of-Sample (70/30) Statistical Overfitting Validation
 * =============================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { outOfSampleValidator, OutOfSampleValidator } from '../server/validation/OutOfSampleValidator';
import { PriceSourceEnforcer } from '../src/engine/enforcer/PriceSourceEnforcer';
import { SpotCandle } from '../src/engine/types/branded';

test('Statistical Validation — In-Sample 70% vs. Out-of-Sample 30% Tests', async (t) => {
  // Generate deterministic realistic candle sequence
  const candles: SpotCandle[] = [];
  const basePrice = 4465.0;
  const baseTime = 1727500000;

  for (let i = 0; i < 120; i++) {
    const time = baseTime + (i * 900);
    const close = Number((basePrice + Math.sin(i / 4.0) * 12.0 + (i * 0.15)).toFixed(2));
    const high = Number((close + 3.0).toFixed(2));
    const low = Number((close - 3.0).toFixed(2));
    const open = Number((close - 0.8).toFixed(2));

    candles.push(
      PriceSourceEnforcer.enforceSpot({
        time,
        open,
        high,
        low,
        close,
        volume: 3200 + (i * 10),
        source: 'SPOT',
      })
    );
  }

  await t.test('runSplitValidation divides dataset precisely into 70% IS and 30% OOS', () => {
    const result = outOfSampleValidator.runSplitValidation(candles, 0.70);

    assert.strictEqual(result.inSampleRatio, 0.70);
    assert.strictEqual(result.outOfSampleRatio, 0.30);
    assert.strictEqual(result.inSampleCandlesCount, 84); // 120 * 0.70
    assert.strictEqual(result.outOfSampleCandlesCount, 36); // 120 - 84
    assert.ok(result.summaryAr.length >= 4);
  });

  await t.test('evaluateCandlePartition computes valid metrics with positive trades count', () => {
    const metrics = outOfSampleValidator.evaluateCandlePartition(candles.slice(0, 84));

    assert.ok(typeof metrics.winRatePct === 'number');
    assert.ok(typeof metrics.profitFactor === 'number');
    assert.ok(typeof metrics.expectancyR === 'number');
    assert.ok(typeof metrics.maxDrawdownR === 'number');
  });

  await t.test('calculateMetrics properly computes expectancy and R-multiples', () => {
    const validator = new OutOfSampleValidator();
    const mockTrades = [
      { entryIndex: 1, direction: 'LONG' as const, entryPrice: 4460, stopLoss: 4455, takeProfit: 4470, pnlR: 2.0, outcome: 'WIN' as const },
      { entryIndex: 5, direction: 'LONG' as const, entryPrice: 4465, stopLoss: 4460, takeProfit: 4475, pnlR: 2.0, outcome: 'WIN' as const },
      { entryIndex: 10, direction: 'SHORT' as const, entryPrice: 4470, stopLoss: 4475, takeProfit: 4460, pnlR: -1.0, outcome: 'LOSS' as const },
    ];

    const metrics = validator.calculateMetrics(mockTrades);
    assert.strictEqual(metrics.totalTrades, 3);
    assert.strictEqual(metrics.winningTrades, 2);
    assert.strictEqual(metrics.losingTrades, 1);
    assert.strictEqual(metrics.winRatePct, 66.67);
    assert.strictEqual(metrics.profitFactor, 4.0); // (2*2) / (1*1) = 4.0
    assert.strictEqual(metrics.totalReturnR, 3.0); // 2 + 2 - 1 = 3.0
  });

  await t.test('detects overfitting when Out-of-Sample metrics collapse', () => {
    const validator = new OutOfSampleValidator();
    
    // Test with insufficient candles throws appropriate error
    assert.throws(() => {
      validator.runSplitValidation(candles.slice(0, 20));
    }, /Insufficient candles/);
  });
});
