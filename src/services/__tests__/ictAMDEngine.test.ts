/**
 * @file ictAMDEngine.test.ts
 * @description اختبارات الوحدة لمحرك توقيت الأخبار والسيولة (ICT AMD).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { getNewYorkHour, detectAsianRange, detectJudasSwingAMD } from '../ictAMDEngine';

test('Task 3 — ictAMDEngine Unit Tests', async (t) => {
  await t.test('getNewYorkHour converts UTC timestamp to NY hour correctly', () => {
    // 04:00 UTC in March (EDT = UTC-4) -> 00:00 NY
    const utcSec = Math.floor(Date.parse('2024-03-15T04:00:00Z') / 1000);
    const nyHour = getNewYorkHour(utcSec);
    assert.strictEqual(nyHour, 0);
  });

  await t.test('detectAsianRange extracts high and low between 20:00 and 00:00 NY', () => {
    // 01:00 UTC = 21:00 NY (inside Asian range 20-24)
    const candles = [
      { time: Math.floor(Date.parse('2024-03-15T01:00:00Z') / 1000), open: 2700, high: 2705, low: 2695, close: 2702 },
      { time: Math.floor(Date.parse('2024-03-15T03:00:00Z') / 1000), open: 2702, high: 2708, low: 2698, close: 2704 },
    ];
    const range = detectAsianRange(candles);
    assert.strictEqual(range.isValid, true);
    assert.strictEqual(range.high, 2708);
    assert.strictEqual(range.low, 2695);
  });

  await t.test('detectJudasSwingAMD identifies manipulation sweep', () => {
    const asianRange = { high: 2708, low: 2695, isValid: true };
    const currentCandle = {
      time: Math.floor(Date.parse('2024-03-15T10:00:00Z') / 1000),
      open: 2706,
      high: 2712, // Swept above 2708
      low: 2704,
      close: 2701,
    };

    const amd = detectJudasSwingAMD(currentCandle, asianRange);
    assert.strictEqual(amd.phase, 'MANIPULATION_SWEEP');
    assert.strictEqual(amd.sweepDirection, 'HIGH');
    assert.strictEqual(amd.isSweep, true);
  });
});
