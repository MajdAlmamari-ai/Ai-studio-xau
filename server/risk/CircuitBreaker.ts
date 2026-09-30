/**
 * CircuitBreaker — Institutional Drawdown & Loss Streak Kill Switch
 * -----------------------------------------------------------------------------
 * Halts execution when consecutive loss thresholds or weekly loss ceilings are
 * breached.
 *
 * STRICT RULES:
 * - Deterministic arithmetic only without random numbers
 * - NO hardcoded values
 * - NO silent fallbacks
 * - Real calculations only
 * - Arabic alert reasons
 */

import { RiskConfig } from './PositionSizer';

export interface CircuitState {
  active: boolean;
  reasonAr: string;
  activatedAt: number;
  canRecover: boolean;
}

export class CircuitBreaker {
  check(
    consecutiveLosses: number,
    weeklyLossPct: number,
    config: RiskConfig
  ): CircuitState {
    const now = Date.now();
    if (consecutiveLosses >= 3) {
      return {
        active: true,
        reasonAr: '3 خسائر متتالية',
        activatedAt: now,
        canRecover: false,
      };
    }
    if (weeklyLossPct >= config.maxWeeklyLoss) {
      return {
        active: true,
        reasonAr: 'تم تجاوز الحد الأسبوعي',
        activatedAt: now,
        canRecover: false,
      };
    }
    return {
      active: false,
      reasonAr: '',
      activatedAt: 0,
      canRecover: true,
    };
  }
}

export const circuitBreaker = new CircuitBreaker();
