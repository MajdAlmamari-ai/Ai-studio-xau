process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  calculateSMCBackend, 
  calculateOBZoneFreshness, 
  DEFAULT_SERVER_SMC_CONFIG 
} from '../server/smcQuantService';
import { DataUnavailableError } from '../src/engine/enforcer/PriceSourceEnforcer';

test('SMC Quant Engine - Core Institutional Calculations', async (t) => {
  await t.test('calculateSMCBackend throws DataUnavailableError (DEPRECATED_PATH)', () => {
    assert.throws(
      () => calculateSMCBackend(4450.0, DEFAULT_SERVER_SMC_CONFIG),
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError);
        assert.strictEqual(err.code, 'DEPRECATED_PATH');
        return true;
      }
    );
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
});
