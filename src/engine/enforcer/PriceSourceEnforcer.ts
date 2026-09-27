/**
 * PriceSourceEnforcer
 * 
 * Runtime validation for price source.
 * Prevents fake data and wrong sources.
 * 
 * NO FAKE DATA:
 * - Validates every incoming candle
 * - Throws DataUnavailableError on invalid
 * - No silent fallbacks
 */

import { DataUnavailableError } from '../../errors/DataUnavailableError';
import {
  SpotCandle,
  FuturesCandle,
  asSpotPrice,
  asFuturesPrice,
} from '../types/branded';

// Re-export DataUnavailableError for backwards compatibility
export { DataUnavailableError };

export class PriceSourceError extends DataUnavailableError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = 'PriceSourceError';
  }
}

export class PriceSourceEnforcer {
  static enforceSpot(candle: unknown): SpotCandle {
    if (!candle || typeof candle !== 'object') {
      throw new PriceSourceError('INVALID_SHAPE', 'Candle is not an object');
    }

    const c = candle as Record<string, unknown>;

    // Validate source
    if (c.source !== 'SPOT') {
      throw new PriceSourceError(
        'WRONG_SOURCE',
        `Expected SPOT, got ${c.source}`
      );
    }

    // Validate timestamp (support up to 1 second drift/future)
    if (typeof c.time !== 'number' || c.time > Date.now() + 1000) {
      throw new PriceSourceError('FUTURE_TIMESTAMP', 'Timestamp invalid');
    }

    // Validate OHLC
    const ohlc = [c.open, c.high, c.low, c.close];
    if (!ohlc.every((v) => typeof v === 'number' && isFinite(v))) {
      throw new PriceSourceError('INVALID_OHLC', 'OHLC values invalid');
    }

    // Validate range
    const h = c.high as number;
    const l = c.low as number;
    if (h < l) {
      throw new PriceSourceError('HIGH_LESS_THAN_LOW', 'High < Low');
    }

    // Validate price range (XAUUSD reasonable: 500-10000)
    const close = c.close as number;
    if (close < 500 || close > 10000) {
      throw new PriceSourceError(
        'OUTLIER_PRICE',
        `XAUUSD price ${close} out of range`
      );
    }

    return {
      time: c.time as number,
      open: asSpotPrice(c.open as number),
      high: asSpotPrice(h),
      low: asSpotPrice(l),
      close: asSpotPrice(close),
      volume: typeof c.volume === 'number' ? c.volume : 0,
      source: 'SPOT',
    };
  }

  static enforceFutures(candle: unknown): FuturesCandle {
    if (!candle || typeof candle !== 'object') {
      throw new PriceSourceError('INVALID_SHAPE', 'Candle is not an object');
    }

    const c = candle as Record<string, unknown>;

    if (c.source !== 'FUTURES') {
      throw new PriceSourceError(
        'WRONG_SOURCE',
        `Expected FUTURES, got ${c.source}`
      );
    }

    if (typeof c.time !== 'number' || c.time > Date.now() + 1000) {
      throw new PriceSourceError('FUTURE_TIMESTAMP', 'Timestamp invalid');
    }

    const ohlc = [c.open, c.high, c.low, c.close];
    if (!ohlc.every((v) => typeof v === 'number' && isFinite(v))) {
      throw new PriceSourceError('INVALID_OHLC', 'OHLC values invalid');
    }

    const h = c.high as number;
    const l = c.low as number;
    if (h < l) {
      throw new PriceSourceError('HIGH_LESS_THAN_LOW', 'High < Low');
    }

    const close = c.close as number;
    if (close < 500 || close > 10000) {
      throw new PriceSourceError(
        'OUTLIER_PRICE',
        `GC1! price ${close} out of range`
      );
    }

    return {
      time: c.time as number,
      open: asFuturesPrice(c.open as number),
      high: asFuturesPrice(h),
      low: asFuturesPrice(l),
      close: asFuturesPrice(close),
      volume: typeof c.volume === 'number' ? c.volume : 0,
      openInterest: typeof c.openInterest === 'number' ? c.openInterest : undefined,
      source: 'FUTURES',
    };
  }
}
