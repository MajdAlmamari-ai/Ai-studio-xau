/**
 * Futures Basis Engine
 * -----------------------------------------------------------------------------
 * Computes:
 * - Basis = Futures - Spot
 * - Basis Mean, StdDev, and Z-Score
 * - Market Structure: Contango (Futures > Spot) vs Backwardation (Spot > Futures)
 * - Status: NORMAL | ELEVATED | EXTREME
 * 
 * STRICT RULES:
 * - Deterministic mathematical formulas
 * - DataUnavailableError on insufficient or invalid history
 * - NO Math.random
 */

import { DataUnavailableError } from '../../src/errors/DataUnavailableError';

export interface BasisMetrics {
  current: number;
  mean: number;
  stdDev: number;
  zScore: number;
  status: 'NORMAL' | 'ELEVATED' | 'EXTREME';
  marketStructure: 'CONTANGO' | 'BACKWARDATION';
}

export class BasisEngine {
  /**
   * Calculate basis metrics given an array of historical basis values.
   * The last element in `history` is treated as the current basis.
   */
  public calculate(history: number[]): BasisMetrics {
    if (!Array.isArray(history) || history.length === 0) {
      throw new DataUnavailableError(
        'INSUFFICIENT_BASIS_HISTORY',
        'At least one basis observation is required'
      );
    }

    const current = Number(history[history.length - 1].toFixed(2));
    const n = history.length;
    const mean = Number((history.reduce((sum, val) => sum + val, 0) / n).toFixed(2));

    let variance = 0;
    for (const val of history) {
      variance += Math.pow(val - mean, 2);
    }
    const stdDev = Number(Math.sqrt(variance / n).toFixed(4));

    let zScore = 0;
    if (stdDev > 0.0001) {
      zScore = Number(((current - mean) / stdDev).toFixed(2));
    }

    let status: 'NORMAL' | 'ELEVATED' | 'EXTREME' = 'NORMAL';
    const absZ = Math.abs(zScore);
    if (absZ >= 2.5) {
      status = 'EXTREME';
    } else if (absZ >= 1.5) {
      status = 'ELEVATED';
    }

    // Market structure: Contango if futures > spot (basis >= 0), Backwardation if spot > futures (basis < 0)
    const marketStructure: 'CONTANGO' | 'BACKWARDATION' =
      current >= 0 ? 'CONTANGO' : 'BACKWARDATION';

    return {
      current,
      mean,
      stdDev,
      zScore,
      status,
      marketStructure,
    };
  }
}

export const basisEngine = new BasisEngine();
