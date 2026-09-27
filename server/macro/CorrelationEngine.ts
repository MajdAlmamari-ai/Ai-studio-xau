/**
 * Macro Correlation Engine
 * -----------------------------------------------------------------------------
 * Computes rolling correlation between Gold and:
 * - DXY (Dollar Index Proxy)
 * - Real Yields (10Y TIPS)
 * 
 * STRICT RULES:
 * - Real mathematical calculations only
 * - DataUnavailableError if insufficient data
 * - NO Math.random / NO hardcoded assumptions
 */

import { DataUnavailableError } from '../../src/errors/DataUnavailableError';

export type CorrelationRegime =
  | 'CLASSIC_INVERSE'
  | 'WEAK_INVERSE'
  | 'DECOUPLED'
  | 'NEUTRAL';

export class CorrelationEngine {
  /**
   * Calculate Pearson correlation coefficient between two numeric series over a rolling window.
   */
  public calculateRolling(
    gold: number[],
    other: number[],
    window: number = 20
  ): number {
    if (!Array.isArray(gold) || !Array.isArray(other)) {
      throw new DataUnavailableError(
        'INVALID_SERIES_INPUT',
        'Both input series must be arrays of numbers'
      );
    }

    const len = Math.min(gold.length, other.length);
    if (len < window || window < 3) {
      throw new DataUnavailableError(
        'INSUFFICIENT_CORRELATION_DATA',
        `Need at least ${window} points for rolling correlation, got ${len}`
      );
    }

    const gSlice = gold.slice(len - window, len);
    const oSlice = other.slice(len - window, len);

    const meanG = gSlice.reduce((s, x) => s + x, 0) / window;
    const meanO = oSlice.reduce((s, x) => s + x, 0) / window;

    let cov = 0;
    let varG = 0;
    let varO = 0;

    for (let i = 0; i < window; i++) {
      const diffG = gSlice[i] - meanG;
      const diffO = oSlice[i] - meanO;
      cov += diffG * diffO;
      varG += diffG * diffG;
      varO += diffO * diffO;
    }

    if (varG <= 0.0000001 || varO <= 0.0000001) {
      return 0;
    }

    const corr = cov / Math.sqrt(varG * varO);
    return Number(Math.max(-1, Math.min(1, corr)).toFixed(4));
  }

  /**
   * Classify macro correlation regime for Gold vs DXY or Real Yields.
   * Under standard economic theory:
   * - r < -0.60: Strong inverse correlation (classic macro behavior)
   * - -0.60 <= r < -0.20: Weak inverse
   * - -0.20 <= r <= 0.20: Neutral / low correlation
   * - r > 0.20: Decoupled (Gold rising with Dollar/Yields, often geopolitical or crisis flight)
   */
  public getRegime(correlation: number): CorrelationRegime {
    if (typeof correlation !== 'number' || isNaN(correlation)) {
      throw new DataUnavailableError(
        'INVALID_CORRELATION_VALUE',
        'Correlation must be a valid number'
      );
    }

    if (correlation < -0.60) {
      return 'CLASSIC_INVERSE';
    } else if (correlation < -0.20) {
      return 'WEAK_INVERSE';
    } else if (correlation <= 0.20) {
      return 'NEUTRAL';
    } else {
      return 'DECOUPLED';
    }
  }
}

export const correlationEngine = new CorrelationEngine();
