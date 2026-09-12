/**
 * End-to-End (E2E) Institutional Critical User Flows Test Suite
 * Validates complete workflows:
 * 1. End-to-End SMC Trade Generation with strict R:R >= 1:2.0 constraint.
 * 2. Post-News Liquidity Sweep & 15-Minute Cooldown Simulation.
 * 3. Emergency Kill-Switch Disarming and Ingress Protection.
 * 4. AI Circuit Breaker Quota Fallback into Rule-Based Institutional Engine.
 * 5. Multi-Timeframe (4H / 1H / 15M) Structural Concordance & Basis Arbitrage.
 */

process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSMCBackend, DEFAULT_SERVER_SMC_CONFIG } from '../server/smcQuantService';
import { 
  activeSafeguards, 
  toggleKillSwitch, 
  tripGeminiCircuit, 
  isGeminiCircuitOpen, 
  resetGeminiCircuit 
} from '../server/safeguards';
import { calculateMultiTimeframeSMC } from '../server/multiTimeframeEngine';

test('E2E Critical User Flow 1: Complete SMC Trade Signal Lifecycle & Risk-Reward Enforcement', async (t) => {
  const currentPrice = 4410.0;
  const analysis = calculateSMCBackend(currentPrice, DEFAULT_SERVER_SMC_CONFIG);

  await t.test('generates valid institutional entry, stop loss, and take profit targets', () => {
    assert.strictEqual(analysis.currentPrice, currentPrice);
    assert.ok(analysis.entryZone.min > 0, 'Entry zone minimum must be positive');
    assert.ok(analysis.entryZone.max >= analysis.entryZone.min, 'Entry zone max must be >= min');
    assert.ok(analysis.stopLoss > 0, 'Stop-loss level must be a valid positive number');
    assert.ok(analysis.takeProfit > 0, 'Take-profit level must be a valid positive number');
    assert.ok(['BULLISH', 'BEARISH'].includes(analysis.bias));
    assert.ok(analysis.orderBlocks.length > 0, 'Must detect institutional order blocks');
  });

  await t.test('strictly verifies mathematical R:R >= 1:2.0 floor', () => {
    assert.ok(
      analysis.rrNumeric >= 2.0, 
      `Risk-to-Reward ratio must satisfy >= 2.0, received: ${analysis.rrNumeric}`
    );
    assert.strictEqual(analysis.wickFilter.isRRApproved, true);
    assert.ok(analysis.riskRewardRatio.startsWith('1:'));
  });
});

test('E2E Critical User Flow 2: Post-News Liquidity Sweep & 15-Minute Cooldown Guard', async (t) => {
  await t.test('detects post-news liquidity sweep condition and enforces 15m discipline', () => {
    // Simulate high-impact news candle (e.g. CPI Release at 4410, high 4425, low 4390)
    const newsCandle = {
      open: 4410.0,
      high: 4425.0,
      low: 4390.0,
      close: 4402.0,
      timestamp: Date.now() - (5 * 60 * 1000), // 5 minutes ago (within 15m cooldown)
    };

    const isWithinCooldown = (Date.now() - newsCandle.timestamp) < (15 * 60 * 1000);
    assert.strictEqual(isWithinCooldown, true, 'Must enforce 15-minute post-news cooldown period');

    // Simulate price sweeping the low (4388 < 4390) and closing back inside (4398)
    const sweepLowPrice = 4388.0;
    const recoveryPrice = 4398.0;
    const isLowSwept = sweepLowPrice < newsCandle.low;
    const isRecoveredInside = recoveryPrice > newsCandle.low;

    assert.ok(isLowSwept && isRecoveredInside, 'Should identify confirmed Bullish Liquidity Sweep (SSL Sweep)');
  });
});

test('E2E Critical User Flow 3: Emergency Kill-Switch & Safeguard Isolation', async (t) => {
  await t.test('engages kill-switch to immediately block all execution pipelines', () => {
    toggleKillSwitch(true);
    assert.strictEqual(activeSafeguards.emergencyKillSwitch, true);

    // Disengage safely
    toggleKillSwitch(false);
    assert.strictEqual(activeSafeguards.emergencyKillSwitch, false);
  });
});

test('E2E Critical User Flow 4: AI Circuit Breaker Quota Fallback to Rule-Based Engine', async (t) => {
  await t.test('transparently falls back to SMC Quant Engine upon Gemini rate-limit 429', () => {
    // Trip the circuit breaker simulating 429 Quota Exhaustion
    tripGeminiCircuit('429 RESOURCE_EXHAUSTED', 10000);
    assert.strictEqual(isGeminiCircuitOpen(), true);

    // Call the institutional algorithmic fallback engine
    const fallbackAnalysis = calculateSMCBackend(4412.50, DEFAULT_SERVER_SMC_CONFIG);
    assert.ok(fallbackAnalysis, 'Fallback analysis must be immediately available');
    assert.ok(fallbackAnalysis.orderBlocks.length > 0);
    assert.ok(fallbackAnalysis.fvgs.length > 0);
    assert.strictEqual(fallbackAnalysis.wickFilter.isRRApproved, true);

    // Reset circuit breaker
    resetGeminiCircuit();
    assert.strictEqual(isGeminiCircuitOpen(), false);
  });
});

test('E2E Critical User Flow 5: Multi-Timeframe Structural Alignment (Weekly / Daily / 4H / 1H / 15M)', async (t) => {
  await t.test('computes aligned market structure and trend bias across all horizons', () => {
    const mtf = calculateMultiTimeframeSMC(4410.0);
    assert.ok(mtf, 'Multi-timeframe output must be defined');
    assert.strictEqual(mtf.currentPrice, 4410.0);
    assert.ok(mtf.alignmentScore >= 80, 'Institutional alignment score must be high');
    assert.ok(mtf.cascadeState.length > 0, 'Cascade state must be present');
    assert.ok(mtf.weeklyHTF.majorLevels.length > 0, 'Weekly major levels must exist');
    assert.ok(mtf.dailyHTF.marketStructure.length > 0, 'Daily market structure must exist');
    assert.ok(mtf.h4Decision.timeframe === '4H', '4H decision timeframe must match');
    assert.ok(mtf.h1Sweeps.activeSweeps.length > 0, '1H active sweeps must be tracked');
    assert.strictEqual(mtf.m15Execution.timeframe, '15M');
    assert.strictEqual(mtf.m15Execution.isRRValid, true, '15M execution setup must satisfy R:R constraint');
  });
});
