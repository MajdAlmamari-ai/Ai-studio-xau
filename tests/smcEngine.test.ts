process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  calculateSMCBackend, 
  calculateOBZoneFreshness, 
  scanProximityZones,
  DEFAULT_SERVER_SMC_CONFIG 
} from '../server/smcQuantService';

test('SMC Quant Engine - Core Institutional Calculations', async (t) => {
  await t.test('detects Order Blocks, FVGs, and Liquidity Pools around current price', () => {
    const currentPrice = 4450.0;
    const analysis = calculateSMCBackend(currentPrice, DEFAULT_SERVER_SMC_CONFIG);

    assert.ok(analysis, 'Analysis output should be defined');
    assert.strictEqual(typeof analysis.currentPrice, 'number');
    assert.ok(analysis.orderBlocks.length > 0, 'Should detect at least one Order Block');
    assert.ok(analysis.fvgs.length > 0, 'Should detect at least one FVG');
    assert.ok(analysis.bsl > currentPrice, 'Buy-Side Liquidity (BSL) must be above current price');
    assert.ok(analysis.ssl < currentPrice, 'Sell-Side Liquidity (SSL) must be below current price');
  });

  await t.test('enforces strict Risk:Reward ratio constraint (R:R >= 1:2.0)', () => {
    const analysis = calculateSMCBackend(4400.0, DEFAULT_SERVER_SMC_CONFIG);
    
    assert.ok(analysis.rrNumeric >= 2.0, `Recommendation R:R must be >= 2.0, received: ${analysis.rrNumeric}`);
    assert.strictEqual(analysis.wickFilter.isRRApproved, true, 'Wick filter must approve R:R');
  });

  await t.test('calculates Zone Freshness Index correctly with decay rules', () => {
    // Unmitigated, freshly created block (1 bar old)
    const fresh = calculateOBZoneFreshness(1, 'Unmitigated');
    assert.strictEqual(fresh.score, 100);
    assert.strictEqual(fresh.tier, 'SUPER_FRESH');

    // Tested block (barsAge = 8, 'Tested')
    const tested = calculateOBZoneFreshness(8, 'Tested');
    assert.ok(tested.score < 80, 'Tested block should have decayed freshness');
    assert.strictEqual(tested.tier, 'MODERATE');

    // Breached / old block (barsAge = 22, 'Breached')
    const breached = calculateOBZoneFreshness(22, 'Breached');
    assert.strictEqual(breached.score, 0);
    assert.strictEqual(breached.tier, 'ERODED');
  });

  await t.test('scans proximity alerts within <= $2.0 threshold', () => {
    const spot = 4410.0;
    const mockOBs = [
      {
        id: 'ob-1',
        type: 'BULLISH_DEMAND',
        min: 4409.0,
        max: 4411.0,
      }
    ];

    const proximity = scanProximityZones(spot, mockOBs, []);
    assert.strictEqual(proximity.isUnderAlert, true, 'Should trigger alert when price is inside/near zone');
    assert.ok(proximity.nearestDistance <= 2.0, 'Distance must be <= 2.0');
    assert.ok(proximity.alerts.length > 0, 'Alerts array should contain detected zone');
  });

  await t.test('validates Wick Protection & ATR Spring Coil compression logic', () => {
    const analysis = calculateSMCBackend(4420.0);
    assert.ok(analysis.compression, 'Compression data must exist');
    assert.strictEqual(typeof analysis.compression.atr1h, 'number');
    assert.strictEqual(analysis.compression.isSpringCoilActive, true);
    assert.ok(analysis.wickFilter, 'Wick filter data must exist');
    assert.strictEqual(typeof analysis.wickFilter.calculatedStopLoss, 'number');
    assert.strictEqual(analysis.wickFilter.isRRApproved, true);
  });
});
