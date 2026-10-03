/**
 * @file spotRecommendationEngine.test.ts
 * @description اختبارات الوحدة لمحرك توصيات السعر الفوري المدمج (Spot XAUUSD).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSpotRecommendation } from '../spotRecommendationEngine';

test('Task 4 — spotRecommendationEngine Unit Tests', async (t) => {
  await t.test('generateSpotRecommendation produces valid recommendation without volume', () => {
    const currentPrice = 2705.5;
    const atr = 5.0;
    const multiTfAlignment = {
      confluenceScore: 82,
      overallBias: 'LONG' as const,
      timeframeDetails: {},
      rationaleAr: 'توافق شرائي مؤسساتي قوي',
    };
    const amdResult = {
      phase: 'MANIPULATION_SWEEP' as const,
      sweepDirection: 'LOW' as const,
      isSweep: true,
      rationaleAr: 'تم سحب قاع الآسيوي وبدء الانعكاس',
    };
    const wickResult = {
      isUpperWickValid: true,
      isLowerWickValid: true,
      upperWickSize: 2.0,
      lowerWickSize: 1.5,
      maxAllowedWick: 10.0,
    };

    const rec = generateSpotRecommendation(currentPrice, atr, multiTfAlignment, amdResult, wickResult);
    assert.ok(rec);
    assert.strictEqual(rec.action, 'BUY');
    assert.ok(rec.stopLoss < currentPrice);
    assert.ok(rec.takeProfit1 > currentPrice);
    assert.ok(rec.takeProfit2 > rec.takeProfit1);
    assert.ok(typeof rec.rationaleAr === 'string');
    assert.ok(rec.rationaleAr.length > 0);
  });
});
