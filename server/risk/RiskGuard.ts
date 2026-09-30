/**
 * RiskGuard — Account Daily Drawdown & Risk Guard
 * -----------------------------------------------------------------------------
 * Enforces maximum daily drawdown boundaries based on start-of-day balance.
 *
 * STRICT RULES:
 * - Deterministic arithmetic only without random numbers
 * - NO hardcoded values
 * - NO silent fallbacks
 * - Real calculations only
 * - Arabic alert reasons
 */

import { RiskConfig } from './PositionSizer';

export interface DailyState {
  startOfDayBalance: number;
  currentBalance: number;
  dailyLossPct: number;
  tradingAllowed: boolean;
  reasonAr?: string;
}

export class RiskGuard {
  checkDaily(
    config: RiskConfig,
    startOfDayBalance: number,
    currentBalance: number
  ): DailyState {
    const dailyLossPct = (startOfDayBalance - currentBalance) / startOfDayBalance;
    const exceeded = dailyLossPct >= config.maxDailyLoss;
    return {
      startOfDayBalance,
      currentBalance,
      dailyLossPct,
      tradingAllowed: !exceeded,
      reasonAr: exceeded ? 'تم تجاوز الحد اليومي للخسارة' : undefined,
    };
  }
}

export const riskGuard = new RiskGuard();
