/**
 * Unit Tests for FuturesEngine
 * -----------------------------------------------------------------------------
 * Tests:
 * - analyze() throws if insufficient candles (< 30)
 * - calculateATR() works with real data
 * - calculateVWAP() works with real data
 * - calculateCVD() uses Institutional Delta
 * - analyzeSessions() returns correct sessions
 * - enforcer validates futures candles
 * 
 * NO Math.random. NO fake data.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FuturesEngine } from '../FuturesEngine';
import { CandleRepository } from '../../candleRepository';
import { PriceSourceEnforcer, DataUnavailableError, PriceSourceError } from '../../../src/engine/enforcer/PriceSourceEnforcer';
import { FuturesCandle } from '../../../src/engine/types/branded';

test('FuturesEngine — Unit Tests', async (t) => {
  // Mock CandleRepository for controlled unit testing
  const createMockRepo = (candles: any[]) => {
    return {
      getFuturesCandles: (_tf: string, _limit: number) => candles,
    } as unknown as CandleRepository;
  };

  await t.test('analyze() throws DataUnavailableError if insufficient candles (< 30)', async () => {
    const mockRepo = createMockRepo([
      { time: 1000, open: 2750, high: 2755, low: 2748, close: 2752, volume: 100, source: 'FUTURES' },
    ]);
    const engine = new FuturesEngine(mockRepo);

    await assert.rejects(
      async () => {
        await engine.analyze('15m');
      },
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError, 'Expected DataUnavailableError');
        assert.strictEqual(err.code, 'FUTURES_CANDLES_INSUFFICIENT');
        return true;
      }
    );
  });

  await t.test('calculateATR() works with real futures candle sequence', () => {
    const engine = new FuturesEngine({} as any);

    // Generate deterministic candle sequence with known ATR
    const sampleCandles: FuturesCandle[] = [];
    const baseTime = 1700000000;
    for (let i = 0; i < 20; i++) {
      const open = 2750 + i * 2;
      const high = open + 6;
      const low = open - 4;
      const close = open + 3;
      sampleCandles.push(
        PriceSourceEnforcer.enforceFutures({
          time: baseTime + i * 900,
          open,
          high,
          low,
          close,
          volume: 800,
          source: 'FUTURES',
        })
      );
    }

    const atr = engine.calculateATR(sampleCandles, 14);
    assert.ok(atr > 0, `ATR should be positive, got ${atr}`);
    assert.strictEqual(typeof atr, 'number');
    assert.ok(atr >= 8.0 && atr <= 11.0, `Expected ATR in range [8, 11], got ${atr}`);
  });

  await t.test('calculateVWAP() works with real volume and price data', () => {
    const engine = new FuturesEngine({} as any);

    const baseTime = 1700000000;
    const sampleCandles: FuturesCandle[] = [
      PriceSourceEnforcer.enforceFutures({
        time: baseTime,
        open: 2750,
        high: 2760,
        low: 2740,
        close: 2750, // typical = 2750
        volume: 100,
        source: 'FUTURES',
      }),
      PriceSourceEnforcer.enforceFutures({
        time: baseTime + 900,
        open: 2760,
        high: 2780,
        low: 2760,
        close: 2770, // typical = 2770
        volume: 200,
        source: 'FUTURES',
      }),
    ];

    // Typical prices: (2760+2740+2750)/3 = 2750; (2780+2760+2770)/3 = 2770
    // Weighted: (2750*100 + 2770*200) / 300 = (275000 + 554000) / 300 = 829000 / 300 = 2763.33
    const vwap = engine.calculateVWAP(sampleCandles);
    assert.strictEqual(vwap, 2763.33);
  });

  await t.test('calculateVWAP() throws DataUnavailableError when volume is 0', () => {
    const engine = new FuturesEngine({} as any);
    const zeroVolCandles: FuturesCandle[] = [
      PriceSourceEnforcer.enforceFutures({
        time: 1700000000,
        open: 2750,
        high: 2760,
        low: 2740,
        close: 2750,
        volume: 0,
        source: 'FUTURES',
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

  await t.test('calculateCVD() calculates cumulative delta using Institutional Delta formula', () => {
    const engine = new FuturesEngine({} as any);

    const candles: FuturesCandle[] = [
      // Bullish candle: open 2750, close 2756, high 2760, low 2748, vol 100
      // range = 12, (close - open) / range = 6 / 12 = 0.5 -> delta = 50
      PriceSourceEnforcer.enforceFutures({
        time: 1700000000,
        open: 2750,
        high: 2760,
        low: 2748,
        close: 2756,
        volume: 100,
        source: 'FUTURES',
      }),
      // Bearish candle: open 2756, close 2750, high 2758, low 2748, vol 200
      // range = 10, (close - open) / range = -6 / 10 = -0.6 -> delta = -120
      PriceSourceEnforcer.enforceFutures({
        time: 1700000900,
        open: 2756,
        high: 2758,
        low: 2748,
        close: 2750,
        volume: 200,
        source: 'FUTURES',
      }),
    ];

    const cvd = engine.calculateCVD(candles);
    assert.strictEqual(cvd.source, 'INSTITUTIONAL_DELTA_APPROXIMATION');
    assert.strictEqual(cvd.cumulativeDelta, -70); // 50 - 120 = -70
    assert.strictEqual(cvd.buyVolume, 50);
    assert.strictEqual(cvd.sellVolume, 120);
  });

  await t.test('analyzeSessions() returns active sessions and valid liquidity level', () => {
    const engine = new FuturesEngine({} as any);
    const sessionInfo = engine.analyzeSessions();

    assert.ok(Array.isArray(sessionInfo.activeSessions), 'activeSessions must be array');
    assert.ok(
      ['LOW', 'MEDIUM', 'HIGH', 'OPTIMAL'].includes(sessionInfo.liquidityLevel),
      `Invalid liquidity level: ${sessionInfo.liquidityLevel}`
    );
  });

  await t.test('enforcer validates futures candles and rejects invalid data', () => {
    // Valid futures candle
    const valid = PriceSourceEnforcer.enforceFutures({
      time: 1700000000,
      open: 2750,
      high: 2760,
      low: 2740,
      close: 2755,
      volume: 1500,
      openInterest: 50000,
      source: 'FUTURES',
    });
    assert.strictEqual(valid.close, 2755);

    // Reject wrong source (e.g. SPOT passed to enforceFutures)
    assert.throws(
      () => {
        PriceSourceEnforcer.enforceFutures({
          time: 1700000000,
          open: 2750,
          high: 2760,
          low: 2740,
          close: 2755,
          volume: 1500,
          source: 'SPOT' as any,
        });
      },
      (err: any) => {
        assert.ok(err instanceof PriceSourceError);
        assert.strictEqual(err.code, 'WRONG_SOURCE');
        return true;
      }
    );

    // Reject invalid high/low
    assert.throws(
      () => {
        PriceSourceEnforcer.enforceFutures({
          time: 1700000000,
          open: 2750,
          high: 2730,
          low: 2760,
          close: 2755,
          volume: 1500,
          source: 'FUTURES',
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
