/**
 * Resampling Types
 * 
 * All resampling logic must be deterministic.
 * NO Math.random.
 */

import type { NormalizedCandle } from '../types';

export type { NormalizedCandle };

/**
 * Timeframe ratios from a base timeframe.
 * 
 * Example (base = M15):
 *   M30 = 2 × M15
 *   H1  = 4 × M15
 *   H4  = 16 × M15
 *   D1  = 96 × M15 (24 hours × 4 candles/hour)
 *   W1  = 672 × M15 (7 days × 96)
 *   MN1 = ~2880 × M15 (30 days × 96)
 */
export const TIMEFRAME_MINUTES: Record<string, number> = {
  M1: 1,
  M5: 5,
  M15: 15,
  M30: 30,
  H1: 60,
  H4: 240,
  D1: 1440,
  W1: 10080,
  MN1: 43200,
};

export interface ResampleResult {
  ok: boolean;
  candles: NormalizedCandle[];
  ratio: number;
  fromTimeframe: string;
  toTimeframe: string;
  reason?: {
    code: string;
    shortAr: string;
    detailsAr: string;
    howToFix: string[];
  };
}
