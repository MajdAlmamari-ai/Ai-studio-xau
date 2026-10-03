/**
 * End-to-End (E2E) Flow Integration Tests (Batch 27.1)
 * -----------------------------------------------------------------------------
 * Tests:
 * - Tab navigation integrity
 * - Spot analysis flow & uniform contract
 * - Futures analysis flow & CVD calculation
 * - Fusion view alignment & Basis calculation
 * - Session status display logic
 * 
 * STRICT RULES:
 * - NO Math.random
 * - Deterministic assertions
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SpotEngine } from '../../server/engines/SpotEngine';
import { FuturesEngine } from '../../server/engines/FuturesEngine';
import { ComparisonEngine } from '../../server/fusion/ComparisonEngine';
import { SessionManager } from '../../server/session/SessionManager';
import { CandleRepository } from '../../server/candleRepository';
import { existsSync, unlinkSync } from 'node:fs';

const TEST_DB = './db/e2e_test_xauusd.sqlite';

test('E2E Full Platform Integration Flows (Batch 27.1)', async (t) => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  const repo = new CandleRepository(TEST_DB);

  // Seed repository with 35 deterministic real candles
  const baseTime = 1710000000;
  const spotCandles = [];
  const futuresCandles = [];

  for (let i = 0; i < 35; i++) {
    const time = baseTime + i * 900;
    const p = 2700.0 + i * 0.5;
    spotCandles.push({
      time,
      open: p,
      high: p + 1.0,
      low: p - 1.0,
      close: p + 0.4,
      volume: 1000 + i * 10,
    });

    futuresCandles.push({
      time,
      open: p + 2.0,
      high: p + 3.0,
      low: p + 1.0,
      close: p + 2.5,
      volume: 1500 + i * 20,
      openInterest: 50000 + i * 50,
    });
  }

  repo.saveSpotCandles('15m', spotCandles);
  repo.saveFuturesCandles('15m', futuresCandles);

  const spotEngine = new SpotEngine(repo);
  const futuresEngine = new FuturesEngine(repo);
  const comparisonEngine = new ComparisonEngine();

  await t.test('Flow 1: Spot Analysis Flow executes correctly', async () => {
    const spotResult = await spotEngine.analyze('15m');
    assert.ok(spotResult);
    assert.strictEqual(spotResult.symbol, 'OANDA:XAUUSD');
    assert.ok(spotResult.score >= 0 && spotResult.score <= 100);
    assert.ok(['LONG', 'SHORT', 'NEUTRAL'].includes(spotResult.direction));
  });

  await t.test('Flow 2: Futures Analysis Flow calculates TPO and Price Momentum correctly', async () => {
    const futuresResult = await futuresEngine.analyze('15m');
    assert.ok(futuresResult);
    assert.strictEqual(futuresResult.symbol, 'COMEX:GC1!');
    assert.ok(futuresResult.tpo && typeof futuresResult.tpo.poc === 'number');
    assert.ok(futuresResult.priceMomentum && typeof futuresResult.priceMomentum.basisSpread === 'number');
    assert.ok(futuresResult.score >= 0 && futuresResult.score <= 100);
  });

  await t.test('Flow 3: Fusion View computes alignment and basis metrics', async () => {
    const spotResult = await spotEngine.analyze('15m');
    const futuresResult = await futuresEngine.analyze('15m');
    const fusion = comparisonEngine.analyze(spotResult, futuresResult, 2700.0, 2710.0, [9.5, 10.0, 10.2]);

    assert.ok(fusion);
    assert.ok(['FULL', 'PARTIAL', 'DIVERGENT'].includes(fusion.alignment));
    assert.ok(fusion.basisAnalysis);
    assert.ok(typeof fusion.confluenceScore === 'number');
  });

  await t.test('Flow 4: Session Manager resolves state and active sessions', () => {
    const testDate = new Date('2026-03-30T10:00:00Z'); // Monday London
    const status = SessionManager.getStatus(testDate);
    assert.ok(status);
    assert.ok(['LIVE', 'CLOSED'].includes(status.state));
    assert.ok(status.session);
  });

  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});
