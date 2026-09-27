/**
 * Branded Types for Price Source Safety
 * 
 * Prevents Spot/Futures mixing at compile-time.
 * 
 * NO FAKE DATA:
 * - Pure type definitions
 * - No runtime values
 * - No hardcoded numbers
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

export type PriceSource = 'SPOT' | 'FUTURES';

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
