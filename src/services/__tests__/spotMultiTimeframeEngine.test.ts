/**
 * Unit Test for Task 2: spotMultiTimeframeEngine (Spot XAUUSD)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePriceRejection, analyzeTimeframe, analyzeMultiTimeframeAlignment } from '../spotMultiTimeframeEngine';

test('Task 2 — spotMultiTimeframeEngine Unit Tests', async (t) => {
  await t.test('calculatePriceRejection measures lower rejection accurately', () => {
    const candle = {
      time: 1710000000,
      open: 2705,
      high: 2710,
      low: 2680,
      close: 2708,
    };
    const rej = calculatePriceRejection(candle, 5.0, 'LOWER');
    assert.ok(rej > 0, 'Expected valid lower rejection score');
  });

  await t.test('analyzeMultiTimeframeAlignment computes hierarchical alignment', () => {
    const dummyCandles = [
      { time: 1710000000, open: 2700, high: 2710, low: 2695, close: 2705 },
    ];
    const candlesRecord = {
      '1W': dummyCandles,
      '1D': dummyCandles,
      '4H': dummyCandles,
      '1H': dummyCandles,
      '15m': dummyCandles,
    };
    const atrRecord = {
      '1W': 15.0,
      '1D': 10.0,
      '4H': 6.0,
      '1H': 4.0,
      '15m': 2.5,
    };

    const alignment = analyzeMultiTimeframeAlignment(candlesRecord, atrRecord);
    assert.ok(alignment);
    assert.ok(typeof alignment.confluenceScore === 'number');
    assert.ok(['LONG', 'SHORT', 'NEUTRAL'].includes(alignment.overallBias));
  });
});
