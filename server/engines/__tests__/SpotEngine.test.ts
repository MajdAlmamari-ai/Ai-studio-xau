/**
 * Unit Tests for SpotEngine
 * -----------------------------------------------------------------------------
 * Tests:
 * - analyze() throws if insufficient candles
 * - calculateATR() works with real data
 * - calculateVWAP() works with real data
 * - analyzeSessions() returns correct sessions
 * - enforcer validates spot candles
 * 
 * NO Math.random. NO fake data.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SpotEngine } from '../SpotEngine';
import { CandleRepository } from '../../candleRepository';
import { PriceSourceEnforcer, DataUnavailableError, PriceSourceError } from '../../../src/engine/enforcer/PriceSourceEnforcer';
import { SpotCandle } from '../../../src/engine/types/branded';

test('SpotEngine — Unit Tests', async (t) => {
  // Mock CandleRepository for controlled unit testing
  const createMockRepo = (candles: any[]) => {
    return {
      getSpotCandles: (_tf: string, _limit: number) => candles,
    } as unknown as CandleRepository;
  };

  await t.test('analyze() throws DataUnavailableError if insufficient candles (< 30)', async () => {
    const mockRepo = createMockRepo([
      { time: 1000, open: 2700, high: 2705, low: 2698, close: 2702, volume: 100, source: 'SPOT' },
    ]);
    const engine = new SpotEngine(mockRepo);

    await assert.rejects(
      async () => {
        await engine.analyze('15m');
      },
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError, 'Expected DataUnavailableError');
        assert.strictEqual(err.code, 'SPOT_CANDLES_INSUFFICIENT');
        return true;
      }
    );
  });

  await t.test('calculateATR() works with real candle sequence', () => {
    const engine = new SpotEngine({} as any);

    // Generate deterministic candle sequence with known ATR
    const sampleCandles: SpotCandle[] = [];
    const baseTime = 1700000000;
    for (let i = 0; i < 20; i++) {
      const open = 2700 + i * 2;
      const high = open + 5;
      const low = open - 3;
      const close = open + 2;
      sampleCandles.push(
        PriceSourceEnforcer.enforceSpot({
          time: baseTime + i * 900,
          open,
          high,
          low,
          close,
          volume: 500,
          source: 'SPOT',
        })
      );
    }

    const atr = engine.calculateATR(sampleCandles, 14);
    assert.ok(atr > 0, `ATR should be positive, got ${atr}`);
    assert.strictEqual(typeof atr, 'number');
    assert.ok(atr >= 7.0 && atr <= 9.0, `Expected ATR in range [7, 9], got ${atr}`);
  });

  await t.test('calculateVWAP() works with real volume and price data', () => {
    const engine = new SpotEngine({} as any);

    const baseTime = 1700000000;
    const sampleCandles: SpotCandle[] = [
      PriceSourceEnforcer.enforceSpot({
        time: baseTime,
        open: 2700,
        high: 2710,
        low: 2690,
        close: 2700, // typical = 2700
        volume: 100,
        source: 'SPOT',
      }),
      PriceSourceEnforcer.enforceSpot({
        time: baseTime + 900,
        open: 2710,
        high: 2730,
        low: 2710,
        close: 2720, // typical = 2720
        volume: 200,
        source: 'SPOT',
      }),
    ];

    // Typical prices: (2710+2690+2700)/3 = 2700; (2730+2710+2720)/3 = 2720
    // Weighted: (2700*100 + 2720*200) / 300 = (270000 + 544000) / 300 = 814000 / 300 = 2713.33
    const vwap = engine.calculateVWAP(sampleCandles);
    assert.strictEqual(vwap, 2713.33);
  });

  await t.test('calculateVWAP() throws DataUnavailableError when volume is 0', () => {
    const engine = new SpotEngine({} as any);
    const zeroVolCandles: SpotCandle[] = [
      PriceSourceEnforcer.enforceSpot({
        time: 1700000000,
        open: 2700,
        high: 2710,
        low: 2690,
        close: 2700,
        volume: 0,
        source: 'SPOT',
      }),
    ];

    assert.throws(
      () => engine.calculateVWAP(zeroVolCandles),
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError);
        assert.strictEqual(err.code, 'VWAP_UNAVAILABLE');
        return true;
      }
    );
  });

  await t.test('analyzeSessions() returns active sessions and valid liquidity level', () => {
    const engine = new SpotEngine({} as any);
    const sessionInfo = engine.analyzeSessions();

    assert.ok(Array.isArray(sessionInfo.activeSessions), 'activeSessions must be array');
    assert.ok(
      ['LOW', 'MEDIUM', 'HIGH', 'OPTIMAL'].includes(sessionInfo.liquidityLevel),
      `Invalid liquidity level: ${sessionInfo.liquidityLevel}`
    );
  });

  await t.test('enforcer validates spot candles and rejects invalid data', () => {
    // Valid spot candle
    const valid = PriceSourceEnforcer.enforceSpot({
      time: 1700000000,
      open: 2700,
      high: 2710,
      low: 2690,
      close: 2705,
      volume: 1500,
      source: 'SPOT',
    });
    assert.strictEqual(valid.close, 2705);

    // Reject incorrect source (e.g. FUTURES passed to enforceSpot)
    assert.throws(
      () => {
        PriceSourceEnforcer.enforceSpot({
          time: 1700000000,
          open: 2700,
          high: 2710,
          low: 2690,
          close: 2705,
          volume: 1500,
          source: 'FUTURES' as any,
        });
      },
      (err: any) => {
        assert.ok(err instanceof PriceSourceError);
        assert.strictEqual(err.code, 'WRONG_SOURCE');
        return true;
      }
    );

    // Reject inverted high/low
    assert.throws(
      () => {
        PriceSourceEnforcer.enforceSpot({
          time: 1700000000,
          open: 2700,
          high: 2680,
          low: 2710,
          close: 2705,
          volume: 1500,
          source: 'SPOT',
        });
      },
      (err: any) => {
        assert.ok(err instanceof PriceSourceError);
        assert.strictEqual(err.code, 'INVALID_OHLC');
        return true;
      }
    );
  });
});
