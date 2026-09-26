/**
 * Canonical Timeframe Constants
 * Single source of truth for all timeframe-related logic.
 */

export const TIMEFRAMES = {
  M1: '1m',
  M5: '5m',
  M15: '15m',
  M30: '30m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
  W1: '1w',
} as const;

export type Timeframe = typeof TIMEFRAMES[keyof typeof TIMEFRAMES];

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
};

export const ALL_TIMEFRAMES: Timeframe[] = [
  '1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w',
];

export const MIN_CANDLES_PER_TIMEFRAME: Record<Timeframe, number> = {
  '1m': 5000,
  '5m': 5000,
  '15m': 4000,
  '30m': 3000,
  '1h': 1000,
  '4h': 1000,
  '1d': 200,
  '1w': 52,
};

// TradingView WebSocket resolution mapping
export const TIMEFRAME_TO_TV_RESOLUTION: Record<Timeframe, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1d': '1D',
  '1w': '1W',
};

export const TV_RESOLUTION_TO_TIMEFRAME: Record<string, Timeframe> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '240': '4h',
  '1D': '1d',
  '1W': '1w',
};

export function isCanonicalTimeframe(value: string): value is Timeframe {
  return (ALL_TIMEFRAMES as string[]).includes(value);
}
