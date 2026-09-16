/**
 * Trade Journal Types
 *
 * Records every trade for calibration and analysis.
 * NOT for live decisions. NOT for profit prediction.
 */

import type { NormalizedCandle, Regime } from '../types';

export type { NormalizedCandle, Regime };

export type JournalSource = 'BACKTEST' | 'PAPER' | 'LIVE_READONLY';

export interface TradeJournalEntry {
  readonly id: string;
  readonly decisionId: string | null;
  readonly zoneId: string | null;
  readonly zoneType: 'FVG' | 'OB' | null;
  readonly mitigationCountAtEntry: number | null;
  readonly direction: 'LONG' | 'SHORT';
  readonly entryPrice: number;
  readonly exitPrice: number | null;
  readonly stopPrice: number;
  readonly targetPrice: number;
  readonly entryTime: number;
  readonly exitTime: number | null;
  readonly exitReason: string | null;
  readonly realizedR: number | null;
  readonly mae: number | null;
  readonly mfe: number | null;
  readonly newsStatusAtEntry: string;
  readonly regimeAtEntry: Regime | null;
  readonly sessionAtEntry: string | null;
  readonly spreadAtEntry: number | null;
  readonly slippageAtEntry: number | null;
  readonly source: JournalSource;
}

export interface JournalSummary {
  readonly sampleCount: number;
  readonly winRate: number | null;
  readonly expectancyR: number | null;
  readonly profitFactor: number | null;
  readonly maxDrawdownPct: number | null;
  readonly averageR: number | null;
  readonly medianR: number | null;
  readonly byRegime: Record<string, number>;
  readonly byNewsStatus: Record<string, number>;
  readonly bySession: Record<string, number>;
  readonly byZoneType: Record<string, number>;
}
