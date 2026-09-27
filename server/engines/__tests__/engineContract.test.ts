/**
 * Engine Contract Tests
 * -----------------------------------------------------------------------------
 * Verifies that SpotEngine and FuturesEngine adhere to the unified contract:
 * - Both throw DataUnavailableError for < 30 candles
 * - Both return direction: 'LONG' | 'SHORT' | 'NEUTRAL'
 * - Both return score: 0-100
 * - Both include confluence array + timestamp
 * - SpotEngine uses SpotCandle[]
 * - FuturesEngine uses FuturesCandle[]
 * 
 * STRICT: NO Math.random. Deterministic.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spotEngine } from '../SpotEngine';
import { futuresEngine } from '../FuturesEngine';
import { PriceSourceEnforcer, DataUnavailableError } from '../../../src/engine/enforcer/PriceSourceEnforcer';
import { SpotCandle, FuturesCandle } from '../../../src/engine/types/branded';

test('Engine Contract — Spot & Futures Uniformity', async (t) => {
  const baseTime = 1700000000;

  // 1. Minimum Candles Guard (< 30 candles throws DataUnavailableError)
  await t.test('Contract: Both engines reject < 30 candles with DataUnavailableError', () => {
    const insufficientSpot: SpotCandle[] = [];
    const insufficientFutures: FuturesCandle[] = [];

    for (let i = 0; i < 20; i++) {
      insufficientSpot.push(
        PriceSourceEnforcer.enforceSpot({
          time: baseTime + i * 900,
          open: 2700 + i,
          high: 2705 + i,
          low: 2698 + i,
          close: 2702 + i,
          volume: 100,
          source: 'SPOT',
        })
      );
      insufficientFutures.push(
        PriceSourceEnforcer.enforceFutures({
          time: baseTime + i * 900,
          open: 2750 + i,
          high: 2755 + i,
          low: 2748 + i,
          close: 2752 + i,
          volume: 100,
          source: 'FUTURES',
        })
      );
    }

    assert.throws(
      () => spotEngine.analyzeCandles(insufficientSpot),
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError);
        assert.strictEqual(err.code, 'INSUFFICIENT_CANDLES');
        return true;
      }
    );

    assert.throws(
      () => futuresEngine.analyzeCandles(insufficientFutures),
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError);
        assert.strictEqual(err.code, 'INSUFFICIENT_CANDLES');
        return true;
      }
    );
  });

  // 2. Uniform Return Contract
  await t.test('Contract: Both engines return valid direction, score (0-100), confluence, and timestamp', () => {
    const validSpot: SpotCandle[] = [];
    const validFutures: FuturesCandle[] = [];

    for (let i = 0; i < 35; i++) {
      const sOpen = 2700 + (i % 4) * 2;
      validSpot.push(
        PriceSourceEnforcer.enforceSpot({
          time: baseTime + i * 900,
          open: sOpen,
          high: sOpen + 4,
          low: sOpen - 3,
          close: sOpen + 1,
          volume: 500,
          source: 'SPOT',
        })
      );

      const fOpen = 2750 + (i % 4) * 2;
      validFutures.push(
        PriceSourceEnforcer.enforceFutures({
          time: baseTime + i * 900,
          open: fOpen,
          high: fOpen + 5,
          low: fOpen - 4,
          close: fOpen + 2,
          volume: 750,
          openInterest: 60000,
          source: 'FUTURES',
        })
      );
    }

    const spotRes = spotEngine.analyzeCandles(validSpot);
    const futuresRes = futuresEngine.analyzeCandles(validFutures);

    // Direction contract
    const validDirections = ['LONG', 'SHORT', 'NEUTRAL'];
    assert.ok(validDirections.includes(spotRes.direction), `Spot direction invalid: ${spotRes.direction}`);
    assert.ok(validDirections.includes(futuresRes.direction), `Futures direction invalid: ${futuresRes.direction}`);

    // Score contract (0 - 100)
    assert.strictEqual(typeof spotRes.score, 'number');
    assert.ok(spotRes.score >= 0 && spotRes.score <= 100);
    assert.strictEqual(typeof futuresRes.score, 'number');
    assert.ok(futuresRes.score >= 0 && futuresRes.score <= 100);

    // Confluence contract
    assert.ok(Array.isArray(spotRes.confluence), 'Spot confluence must be array');
    assert.ok(Array.isArray(futuresRes.confluence), 'Futures confluence must be array');

    // Timestamp contract
    assert.strictEqual(typeof spotRes.timestamp, 'number');
    assert.ok(spotRes.timestamp > 0);
    assert.strictEqual(typeof futuresRes.timestamp, 'number');
    assert.ok(futuresRes.timestamp > 0);
  });
});
