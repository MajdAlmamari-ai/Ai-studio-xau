/**
 * TradingView History Client (Frontend)
 *
 * Fetches historical candles from /api/tv/history.
 * Primary: COMEX:GC1! (Gold Futures - COMEX)
 * Secondary: OANDA:XAUUSD (Spot Gold)
 *
 * Deterministic. NO Math.random.
 * NO fake data.
 */

import { Candle } from '../types/sharedTypes';
import { TIMEFRAME_MS, Timeframe } from '../constants/timeframes';

export type TvHistorySymbolKey = 'futures' | 'spot';

export interface TvHistoryRequest {
  key: TvHistorySymbolKey;
  timeframe: Timeframe;
  barCount: number;
}

export interface TvHistoryResponse {
  ok: true;
  symbol: string;
  timeframe: string;
  bars: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | null;
  }>;
  fetchedAt: number;
}

export interface TvHistoryError {
  code: string;
  shortAr: string;
  detailsAr: string;
  howToFix: string[];
}

export type TvHistoryResult =
  | { ok: true; candles: Candle[]; symbol: string }
  | { ok: false; reason: TvHistoryError };

const TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTvHistory(
  req: TvHistoryRequest,
): Promise<TvHistoryResult> {
  const url = `/api/tv/history/${req.key}?timeframe=${req.timeframe}&count=${req.barCount}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        reason: {
          code: `TV_HISTORY_HTTP_${res.status}`,
          shortAr: `TradingView history HTTP ${res.status}`,
          detailsAr: body?.error || res.statusText,
          howToFix: ['أعد المحاولة', 'تحقق من الاتصال'],
        },
      };
    }

    const data: TvHistoryResponse = await res.json();
    const candles: Candle[] = data.bars.map((b) => ({
      symbol: 'XAUUSD',
      timeframe: req.timeframe,
      openTime: b.time * 1000,
      closeTime: b.time * 1000 + TIMEFRAME_MS[req.timeframe],
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      volumeType: b.volume !== null ? 'CONTRACT' : 'UNAVAILABLE',
      complete: true,
      source: 'tradingview',
    }));

    return { ok: true, candles, symbol: data.symbol };
  } catch (err: any) {
    return {
      ok: false,
      reason: {
        code: 'TV_HISTORY_NETWORK_ERROR',
        shortAr: 'فشل جلب التاريخ من TradingView',
        detailsAr: String(err?.message || 'Unknown'),
        howToFix: ['أعد المحاولة'],
      },
    };
  }
}
