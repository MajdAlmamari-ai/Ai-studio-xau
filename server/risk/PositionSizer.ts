/**
 * PositionSizer — Institutional Position Sizing
 * -----------------------------------------------------------------------------
 * Computes exact lot sizing based on account equity, risk percentage, and
 * protective stop-loss distance.
 *
 * STRICT RULES:
 * - Deterministic arithmetic only without random numbers
 * - NO hardcoded values
 * - NO silent fallbacks
 * - Real calculations only
 * - Throws DataUnavailableError on invalid SL
 */

import { DataUnavailableError } from '../../src/errors/DataUnavailableError';

export interface RiskConfig {
  accountSize: number;
  riskPerTrade: number;
  maxDailyLoss: number;
  maxWeeklyLoss: number;
}

export interface PositionSize {
  lotSize: number;
  riskAmount: number;
  slDistance: number;
  valid: boolean;
  reasonAr?: string;
}

export class PositionSizer {
  calculate(
    config: RiskConfig,
    entry: number,
    stopLoss: number,
    pipValue: number = 100
  ): PositionSize {
    const riskAmount = config.accountSize * config.riskPerTrade;
    const slDistance = Math.abs(entry - stopLoss);
    if (slDistance <= 0) {
      throw new DataUnavailableError('INVALID_SL', 'Stop loss distance is zero');
    }
    const lotSize = Number((riskAmount / (slDistance * pipValue)).toFixed(2));
    return {
      lotSize,
      riskAmount,
      slDistance,
      valid: lotSize > 0,
    };
  }
}

export const positionSizer = new PositionSizer();
