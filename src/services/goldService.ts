import { ChartTimeframe } from '../types';

export interface MTFSummaryItem {
  timeframe: ChartTimeframe;
  price: number;
  change: number;
  changePercent: number;
  range: number;
  high: number;
  low: number;
  quality: 'FULL' | 'PARTIAL' | 'MISSING';
  isPending: boolean;
  candleCount: number;
}

export interface MTFSummaryResponse {
  symbol: string;
  price: number;
  updatedAt: string;
  timeframes: Record<string, MTFSummaryItem>;
}

export async function fetchMTFSummary(): Promise<MTFSummaryResponse | null> {
  try {
    const res = await fetch('/api/gold/mtf-summary');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[GoldService] fetchMTFSummary failed:', err);
    return null;
  }
}
