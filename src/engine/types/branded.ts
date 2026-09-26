/**
 * Branded Types — Spot vs Futures
 * 
 * Compile-time protection against mixing Spot and Futures data.
 */

declare const SpotBrand: unique symbol;
declare const FuturesBrand: unique symbol;

export type SpotPrice = number & { readonly [SpotBrand]: true };
export type FuturesPrice = number & { readonly [FuturesBrand]: true };

export function asSpotPrice(value: number): SpotPrice {
  return value as SpotPrice;
}

export function asFuturesPrice(value: number): FuturesPrice {
  return value as FuturesPrice;
}

export interface SpotCandle {
  time: number;
  open: SpotPrice;
  high: SpotPrice;
  low: SpotPrice;
  close: SpotPrice;
  volume: number;
  source: 'SPOT';
}

export interface FuturesCandle {
  time: number;
  open: FuturesPrice;
  high: FuturesPrice;
  low: FuturesPrice;
  close: FuturesPrice;
  volume: number;
  openInterest?: number;
  source: 'FUTURES';
}

export function isSpotCandle(candle: unknown): candle is SpotCandle {
  return (
    typeof candle === 'object' &&
    candle !== null &&
    (candle as SpotCandle).source === 'SPOT'
  );
}

export function isFuturesCandle(candle: unknown): candle is FuturesCandle {
  return (
    typeof candle === 'object' &&
    candle !== null &&
    (candle as FuturesCandle).source === 'FUTURES'
  );
}

export const DATA_SOURCES = {
  SPOT: {
    symbol: 'OANDA:XAUUSD',
    role: 'execution',
    description: 'Spot Gold for Entry/SL/TP',
  },
  FUTURES: {
    symbol: 'COMEX:GC1!',
    role: 'analysis',
    description: 'COMEX Gold Futures for Structure/Volume',
  },
} as const;
