/**
 * Unit Test Suite for Monte Carlo Stochastic Simulation Engine
 * =============================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { monteCarloSimulator, MonteCarloSimulator } from '../server/validation/MonteCarloSimulator';

test('Monte Carlo Simulation — Quantitative Risk & Drawdown Tests', async (t) => {
  const empiricalReturns = [
    2.0, -1.0, 2.0, -1.0, -1.0, 2.0, 2.0, -1.0, -1.0, 2.0,
    -1.0, 2.0, -1.0, -1.0, 2.0, -1.0, 2.0, 2.0, -1.0, -1.0,
  ];

  await t.test('executes 1,000 simulations and computes empirical percentiles', () => {
    const result = monteCarloSimulator.runSimulation(empiricalReturns, {
      numSimulations: 1000,
      tradesPerSimulation: 100,
      accountSize: 50000,
      riskPerTradePct: 0.01,
      seed: 42,
    });

    assert.strictEqual(result.simulationsCount, 1000);
    assert.strictEqual(result.tradesPerPath, 100);
    assert.strictEqual(result.accountSize, 50000);
    assert.strictEqual(result.riskPerTradeUsd, 500);

    // Median return and drawdown checks
    assert.ok(typeof result.expectedReturnR.median === 'number');
    assert.ok(result.expectedReturnR.percentile95th >= result.expectedReturnR.median);
    assert.ok(result.expectedReturnR.median >= result.expectedReturnR.percentile5th);

    // Drawdowns must be non-negative R-values
    assert.ok(result.drawdownRiskR.medianDrawdown >= 0);
    assert.ok(result.drawdownRiskR.maxDrawdown99thPct >= result.drawdownRiskR.maxDrawdown95thPct);
    assert.ok(result.drawdownRiskR.maxDrawdown95thPct >= result.drawdownRiskR.medianDrawdown);

    // Loss probability should be between 0% and 100%
    assert.ok(result.lossProbabilityPct >= 0 && result.lossProbabilityPct <= 100);
    assert.ok(result.summaryAr.length >= 4);
  });

  await t.test('financial projections calculate correct dollar amounts and percentages', () => {
    const simulator = new MonteCarloSimulator();
    const result = simulator.runSimulation(empiricalReturns, {
      numSimulations: 100,
      tradesPerSimulation: 50,
      accountSize: 100000,
      riskPerTradePct: 0.02, // 2% = $2,000 per R
      seed: 123,
    });

    assert.strictEqual(result.accountSize, 100000);
    assert.strictEqual(result.riskPerTradeUsd, 2000);
    assert.strictEqual(
      result.financialProjections.expectedProfitUsd,
      Number((result.expectedReturnR.median * 2000).toFixed(2))
    );
  });

  await t.test('handles empty or tiny inputs by applying default SMC baseline', () => {
    const simulator = new MonteCarloSimulator();
    const result = simulator.runSimulation([], {
      numSimulations: 50,
      tradesPerSimulation: 20,
    });

    assert.strictEqual(result.simulationsCount, 50);
    assert.ok(result.expectedReturnR.median !== undefined);
  });
});
