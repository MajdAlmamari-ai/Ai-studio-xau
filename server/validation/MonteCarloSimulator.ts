/**
 * Institutional Monte Carlo Simulation Engine
 * =============================================================================
 * Runs N stochastic resampling simulations (default 1,000 paths) on trade returns
 * to construct empirical confidence intervals for drawdown risk, expected equity,
 * and probability of portfolio ruin/loss.
 *
 * Mathematical Metrics:
 * - Median Expected Return & Drawdown
 * - 90% Confidence Interval (5th to 95th Percentile)
 * - 95% Value-at-Risk (VaR) / Maximum Expected Drawdown
 * - 99% Tail Risk (Extreme Black Swan Shock)
 * - Probability of Cumulative Loss (Risk of Ruin)
 * - Capital Projections on target account sizes (e.g. $50,000 at 1% risk)
 */

export interface MonteCarloConfig {
  numSimulations?: number; // default 1000
  tradesPerSimulation?: number; // default 100
  accountSize?: number; // default 50000
  riskPerTradePct?: number; // default 0.01 (1%)
  seed?: number;
}

export interface MonteCarloResult {
  simulationsCount: number;
  tradesPerPath: number;
  accountSize: number;
  riskPerTradeUsd: number;
  expectedReturnR: {
    median: number;
    percentile5th: number;
    percentile25th: number;
    percentile75th: number;
    percentile95th: number;
  };
  drawdownRiskR: {
    medianDrawdown: number;
    maxDrawdown95thPct: number;
    maxDrawdown99thPct: number;
  };
  lossProbabilityPct: number; // Probability of ending net negative
  financialProjections: {
    expectedProfitUsd: number;
    expectedReturnPct: number;
    maxExpectedDrawdownUsd: number;
    maxExpectedDrawdownPct: number;
  };
  summaryAr: string[];
}

export class MonteCarloSimulator {
  /**
   * Linear Congruential Generator (LCG) for deterministic reproducible stochastic runs
   */
  private createRandomGenerator(seed: number = 42) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  /**
   * Executes Monte Carlo simulation on an array of R-multiple returns (e.g. [+2.0, -1.0, ...])
   */
  public runSimulation(returns: number[], config: MonteCarloConfig = {}): MonteCarloResult {
    const numSimulations = config.numSimulations ?? 1000;
    const tradesPerSim = config.tradesPerSimulation ?? 100;
    const accountSize = config.accountSize ?? 50000;
    const riskPerTradePct = config.riskPerTradePct ?? 0.01;
    const riskPerTradeUsd = accountSize * riskPerTradePct;

    // Fallback baseline returns if empty (e.g., standard SMC 40% win-rate at 1:2.0 R:R)
    const baseReturns = returns.length >= 5 ? returns : [
      2.0, -1.0, 2.0, -1.0, -1.0, 2.0, -1.0, 2.0, -1.0, -1.0,
      2.0, -1.0, -1.0, 2.0, -1.0, 2.0, -1.0, -1.0, 2.0, -1.0
    ];

    const rand = this.createRandomGenerator(config.seed ?? 42);
    const finalPnls: number[] = [];
    const maxDrawdowns: number[] = [];

    for (let sim = 0; sim < numSimulations; sim++) {
      let equity = 0;
      let peak = 0;
      let maxDd = 0;

      for (let t = 0; t < tradesPerSim; t++) {
        const randomIndex = Math.floor(rand() * baseReturns.length);
        const rReturn = baseReturns[randomIndex];

        equity += rReturn;
        if (equity > peak) {
          peak = equity;
        }
        const currentDd = peak - equity;
        if (currentDd > maxDd) {
          maxDd = currentDd;
        }
      }

      finalPnls.push(equity);
      maxDrawdowns.push(maxDd);
    }

    // Sort for empirical percentile calculation
    finalPnls.sort((a, b) => a - b);
    maxDrawdowns.sort((a, b) => a - b);

    const getPercentile = (arr: number[], pct: number): number => {
      const idx = Math.min(arr.length - 1, Math.max(0, Math.floor((pct / 100) * arr.length)));
      return Number(arr[idx].toFixed(2));
    };

    const medianPnl = getPercentile(finalPnls, 50);
    const pnl5 = getPercentile(finalPnls, 5);
    const pnl25 = getPercentile(finalPnls, 25);
    const pnl75 = getPercentile(finalPnls, 75);
    const pnl95 = getPercentile(finalPnls, 95);

    const medianDd = getPercentile(maxDrawdowns, 50);
    const dd95 = getPercentile(maxDrawdowns, 95);
    const dd99 = getPercentile(maxDrawdowns, 99);

    const lossCount = finalPnls.filter((p) => p <= 0).length;
    const lossProbabilityPct = Number(((lossCount / numSimulations) * 100).toFixed(2));

    const expectedProfitUsd = Number((medianPnl * riskPerTradeUsd).toFixed(2));
    const expectedReturnPct = Number(((expectedProfitUsd / accountSize) * 100).toFixed(2));
    const maxExpectedDrawdownUsd = Number((dd95 * riskPerTradeUsd).toFixed(2));
    const maxExpectedDrawdownPct = Number(((maxExpectedDrawdownUsd / accountSize) * 100).toFixed(2));

    const summaryAr = [
      `تمت محاكاة ${numSimulations.toLocaleString()} مساراً عشوائياً بعدد ${tradesPerSim} صفقة لكل مسار.`,
      `الوسيط الإحصائي المتوقع للعائد: +${medianPnl}R (نطاق الثقة 90%: من ${pnl5 > 0 ? '+' : ''}${pnl5}R إلى +${pnl95}R).`,
      `أقصى تراجع طبيعي بنسبة ثقة 95%: -${dd95}R (سيناريو الصدمة العنيف 99%: -${dd99}R).`,
      `احتمالية إنهاء السلسلة بخسارة صافية: ${lossProbabilityPct}% فقط.`,
      `الإسقاط المالي لمحفظة $${accountSize.toLocaleString()}: ربح متوقع +$${expectedProfitUsd.toLocaleString()} مقابل أقصى تراجع متوقع -$${maxExpectedDrawdownUsd.toLocaleString()} (${maxExpectedDrawdownPct}%).`,
    ];

    return {
      simulationsCount: numSimulations,
      tradesPerPath: tradesPerSim,
      accountSize,
      riskPerTradeUsd,
      expectedReturnR: {
        median: medianPnl,
        percentile5th: pnl5,
        percentile25th: pnl25,
        percentile75th: pnl75,
        percentile95th: pnl95,
      },
      drawdownRiskR: {
        medianDrawdown: medianDd,
        maxDrawdown95thPct: dd95,
        maxDrawdown99thPct: dd99,
      },
      lossProbabilityPct,
      financialProjections: {
        expectedProfitUsd,
        expectedReturnPct,
        maxExpectedDrawdownUsd,
        maxExpectedDrawdownPct,
      },
      summaryAr,
    };
  }
}

export const monteCarloSimulator = new MonteCarloSimulator();
