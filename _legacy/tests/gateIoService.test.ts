import test from 'node:test';
import assert from 'node:assert/strict';
import { getGateIoConsolidatedOverview } from '../server/gateIoService';

// Mock Gate.io API responses for instant, reliable, offline CI execution
const mockFetch = async (input: any) => {
  const url = String(input);
  if (url.includes('/spot/tickers')) {
    return {
      ok: true,
      json: async () => [{
        currency_pair: 'PAXG_USDT',
        last: '4405.50',
        change_percentage: '0.45',
        high_24h: '4420.0',
        low_24h: '4390.0',
        base_volume: '1500',
        quote_volume: '6600000',
      }],
    } as any;
  }
  if (url.includes('/futures/usdt/tickers')) {
    return {
      ok: true,
      json: async () => [{
        contract: 'XAU_USDT',
        last: '4410.20',
        mark_price: '4410.15',
        index_price: '4405.50',
        funding_rate: '0.0001',
        volume_24h: '25000',
        volume_24h_quote: '110000000',
        change_percentage: '0.52',
        high_24h: '4425.0',
        low_24h: '4395.0',
      }],
    } as any;
  }
  if (url.includes('/order_book')) {
    return {
      ok: true,
      json: async () => ({
        bids: [['4405.0', '15.5'], ['4404.5', '20.0']],
        asks: [['4406.0', '10.0'], ['4406.5', '14.0']],
      }),
    } as any;
  }
  return { ok: false, statusText: 'Not found' } as any;
};

// Apply mock before tests run
globalThis.fetch = mockFetch;

test('Gate.io Data Service - Normalization & Arbitrage Calculations', async (t) => {
  await t.test('fetches consolidated overview with Spot, Futures, and Basis Metrics', async () => {
    const overview = await getGateIoConsolidatedOverview(true);

    assert.ok(overview, 'Overview should be defined');
    assert.ok(['ONLINE', 'FALLBACK', 'DEGRADED'].includes(overview.status), 'Status must be valid');
    assert.strictEqual(overview.source, 'Gate.io API v4 (Official)');
    
    // Spot ticker verification
    assert.ok(overview.spot, 'Spot ticker must be defined');
    assert.strictEqual(overview.spot.last, 4405.50);
    assert.strictEqual(typeof overview.spot.changePercentage, 'number');

    // Futures ticker verification
    assert.ok(overview.futures, 'Futures ticker must be defined');
    assert.strictEqual(overview.futures.last, 4410.20);
    assert.strictEqual(typeof overview.futures.fundingRate, 'number');

    // Basis calculation verification: Futures - Spot = 4410.20 - 4405.50 = 4.70
    assert.ok(overview.basisMetrics, 'Basis metrics must be defined');
    assert.strictEqual(overview.basisMetrics.basisSpread, 4.70);
    assert.strictEqual(overview.basisMetrics.state, 'CONTANGO');
    assert.ok(overview.basisMetrics.stateLabelAr.length > 0);
  });

  await t.test('provides Order Book Imbalance Ratio with institutional thresholds', async () => {
    const overview = await getGateIoConsolidatedOverview(true);
    
    if (overview.orderBook) {
      assert.ok(overview.orderBook.spot, 'Spot order book must exist');
      assert.ok(overview.orderBook.futures, 'Futures order book must exist');
      
      const spotImbalance = overview.orderBook.spot.imbalanceRatio;
      assert.ok(spotImbalance >= 0 && spotImbalance <= 1, 'Imbalance ratio must be between 0 and 1');
      assert.ok(overview.orderBook.spot.imbalanceVerdictAr.length > 0);
    }
  });
});
