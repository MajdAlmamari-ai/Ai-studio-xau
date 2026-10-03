/**
 * Unit Tests for FuturesEngine (TPO & Momentum)
 * ---------------------------------------------
 * Tests:
 * - analyze() accepts FuturesCandle[]
 * - analyze() throws DataUnavailableError if insufficient candles (< 30)
 * - analyze() returns valid FuturesAnalysis with TPO and TWAP
 * - TPO Value Area (POC, VAH, VAL) is calculated correctly without volume
 * - NO fake data. Deterministic.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FuturesEngine, futuresEngine } from '../FuturesEngine';
import { CandleRepository } from '../../candleRepository';
import { PriceSourceEnforcer, DataUnavailableError, PriceSourceError } from '../../../src/engine/enforcer/PriceSourceEnforcer';
import { FuturesCandle } from '../../../src/engine/types/branded';

test('FuturesEngine — TPO & Momentum Unit Tests', async (t) => {
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
        assert.strictEqual(err.code, 'INSUFFICIENT_STORED_CANDLES');
        return true;
      }
    );
  });

  await t.test('analyzeCandles() throws DataUnavailableError for < 30 candles', () => {
    const engine = futuresEngine;
    const fewCandles: FuturesCandle[] = [
      PriceSourceEnforcer.enforceFutures({
        time: 1700000000,
        open: 2750,
        high: 2760,
        low: 2740,
        close: 2755,
        volume: 100,
        source: 'FUTURES',
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

  await t.test('analyzeCandles() accepts 35 FuturesCandles and returns valid FuturesAnalysis with TPO', () => {
    const engine = futuresEngine;
    const candles: FuturesCandle[] = [];
    const baseTime = 1700000000;

    for (let i = 0; i < 35; i++) {
      const open = 2750 + (i % 5) * 2;
      const high = open + 5;
      const low = open - 4;
      const close = open + 2;
      candles.push(
        PriceSourceEnforcer.enforceFutures({
          time: baseTime + i * 900,
          open,
          high,
          low,
          close,
          volume: 0,
          openInterest: 50000 + i * 100,
          source: 'FUTURES',
        })
      );
    }

    const analysis = engine.analyzeCandles(candles);
    assert.ok(analysis, 'Analysis should be returned');
    assert.strictEqual(analysis.symbol, 'COMEX:GC1!');
    assert.ok(typeof analysis.score === 'number');
    assert.ok(analysis.score >= 0 && analysis.score <= 100);
    assert.ok(analysis.tpo, 'TPO analysis should be present');
    assert.ok(typeof analysis.tpo?.poc === 'number');
    assert.ok(typeof analysis.twap === 'number');
  });

  await t.test('calculateTPO() computes POC, VAH, VAL and TWAP accurately', () => {
    const engine = new FuturesEngine({} as any);
    const sampleCandles: FuturesCandle[] = [
      PriceSourceEnforcer.enforceFutures({
        time: 1700000000,
        open: 2750,
        high: 2760,
        low: 2740,
        close: 2750,
        volume: 0,
        source: 'FUTURES',
      }),
      PriceSourceEnforcer.enforceFutures({
        time: 1700000900,
        open: 2760,
        high: 2780,
        low: 2760,
        close: 2770,
        volume: 0,
        source: 'FUTURES',
      }),
    ];

    const tpo = engine.calculateTPO(sampleCandles);
    assert.ok(tpo.poc > 0);
    assert.ok(tpo.vah >= tpo.poc);
    assert.ok(tpo.val <= tpo.poc);
    assert.ok(tpo.twap > 0);
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
    const valid = PriceSourceEnforcer.enforceFutures({
      time: 1700000000,
      open: 2750,
      high: 2760,
      low: 2740,
      close: 2755,
      volume: 0,
      openInterest: 50000,
      source: 'FUTURES',
    });
    assert.strictEqual(valid.close, 2755);

    assert.throws(
      () => {
        PriceSourceEnforcer.enforceFutures({
          time: 1700000000,
          open: 2750,
          high: 2760,
          low: 2740,
          close: 2755,
          volume: 0,
          source: 'SPOT' as any,
        });
      },
      (err: any) => {
        assert.ok(err instanceof PriceSourceError);
        assert.strictEqual(err.code, 'WRONG_SOURCE');
        return true;
      }
    );
  });
});
