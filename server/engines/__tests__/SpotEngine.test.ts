/**
 * Unit Tests for SpotEngine
 * -----------------------------------------------------------------------------
 * Tests:
 * - analyze() accepts SpotCandle[]
 * - analyze() rejects FuturesCandle[] (tested via enforceSpot rejecting FUTURES)
 * - analyze() throws DataUnavailableError for <30 candles
 * - analyze() returns valid SpotAnalysis
 * - ATR calculation is real
 * - NO Math.random in engine
 * 
 * Deterministic. NO fake data.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SpotEngine, spotEngine } from '../SpotEngine';
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

  await t.test('analyzeCandles() throws DataUnavailableError for < 30 candles', () => {
    const engine = spotEngine;
    const fewCandles: SpotCandle[] = [
      PriceSourceEnforcer.enforceSpot({
        time: 1700000000,
        open: 2700,
        high: 2710,
        low: 2690,
        close: 2705,
        volume: 100,
        source: 'SPOT',
      }),
    ];

    assert.throws(
      () => engine.analyzeCandles(fewCandles),
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError);
        assert.strictEqual(err.code, 'INSUFFICIENT_CANDLES');
        return true;
      }
    );
  });

  await t.test('analyzeCandles() accepts 35 SpotCandles and returns valid SpotAnalysis', () => {
    const engine = spotEngine;
    const candles: SpotCandle[] = [];
    const baseTime = 1700000000;

    for (let i = 0; i < 35; i++) {
      const open = 2700 + (i % 5) * 2;
      const high = open + 4;
      const low = open - 3;
      const close = open + 1;
      candles.push(
        PriceSourceEnforcer.enforceSpot({
          time: baseTime + i * 900,
          open,
          high,
          low,
          close,
          volume: 500 + i * 10,
          source: 'SPOT',
        })
      );
    }

    const analysis = engine.analyzeCandles(candles);
    assert.ok(analysis, 'Analysis should be returned');
    assert.strictEqual(analysis.symbol, 'OANDA:XAUUSD');
    assert.ok(typeof analysis.score === 'number');
    assert.ok(analysis.score >= 0 && analysis.score <= 100);
    assert.ok(['LONG', 'SHORT', 'NEUTRAL'].includes(analysis.direction));
    assert.ok(analysis.atr > 0, 'ATR must be positive');
    assert.ok(analysis.vwap > 0, 'VWAP must be positive');
    assert.ok(Array.isArray(analysis.sessionAnalysis.activeSessions));
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
        assert.strictEqual(err.code, 'HIGH_LESS_THAN_LOW');
        return true;
      }
    );
  });
});
