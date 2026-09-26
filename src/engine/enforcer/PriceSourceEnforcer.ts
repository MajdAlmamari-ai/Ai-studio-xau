import {
  SpotCandle,
  FuturesCandle,
  asSpotPrice,
  asFuturesPrice,
} from '../types/branded';

export class DataUnavailableError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(`[DataUnavailable] ${code}: ${message}`);
    this.name = 'DataUnavailableError';
  }
}

export class PriceSourceError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(`[PriceSource] ${code}: ${message}`);
    this.name = 'PriceSourceError';
  }
}

export interface RawCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openInterest?: number;
  source?: string;
}

export class PriceSourceEnforcer {
  static enforceSpot(raw: RawCandle): SpotCandle {
    if (!this.isValidShape(raw)) {
      throw new PriceSourceError('INVALID_SHAPE', 'Candle missing required fields');
    }
    if (raw.source && raw.source !== 'SPOT') {
      throw new PriceSourceError('WRONG_SOURCE', `Expected SPOT, got ${raw.source}`);
    }
    if (raw.time > Date.now() + 1000) {
      throw new PriceSourceError('FUTURE_TIMESTAMP', `Candle time ${raw.time} is in the future`);
    }
    if (raw.close < 500 || raw.close > 10000) {
      throw new PriceSourceError('OUTLIER_PRICE', `XAUUSD price ${raw.close} out of range`);
    }
    if (raw.high < raw.low) {
      throw new PriceSourceError('INVALID_OHLC', 'High is less than Low');
    }

    return {
      time: raw.time,
      open: asSpotPrice(raw.open),
      high: asSpotPrice(raw.high),
      low: asSpotPrice(raw.low),
      close: asSpotPrice(raw.close),
      volume: raw.volume,
      source: 'SPOT',
    };
  }

  static enforceFutures(raw: RawCandle): FuturesCandle {
    if (!this.isValidShape(raw)) {
      throw new PriceSourceError('INVALID_SHAPE', 'Candle missing required fields');
    }
    if (raw.source && raw.source !== 'FUTURES') {
      throw new PriceSourceError('WRONG_SOURCE', `Expected FUTURES, got ${raw.source}`);
    }
    if (raw.time > Date.now() + 1000) {
      throw new PriceSourceError('FUTURE_TIMESTAMP', `Candle time ${raw.time} is in the future`);
    }
    if (raw.close < 500 || raw.close > 10000) {
      throw new PriceSourceError('OUTLIER_PRICE', `GC1! price ${raw.close} out of range`);
    }
    if (raw.high < raw.low) {
      throw new PriceSourceError('INVALID_OHLC', 'High is less than Low');
    }

    const candle: FuturesCandle = {
      time: raw.time,
      open: asFuturesPrice(raw.open),
      high: asFuturesPrice(raw.high),
      low: asFuturesPrice(raw.low),
      close: asFuturesPrice(raw.close),
      volume: raw.volume,
      source: 'FUTURES',
    };

    if (raw.openInterest !== undefined) {
      candle.openInterest = raw.openInterest;
    }

    return candle;
  }

  private static isValidShape(raw: RawCandle): boolean {
    return (
      typeof raw === 'object' &&
      raw !== null &&
      typeof raw.time === 'number' &&
      typeof raw.open === 'number' &&
      typeof raw.high === 'number' &&
      typeof raw.low === 'number' &&
      typeof raw.close === 'number' &&
      typeof raw.volume === 'number'
    );
  }
}
