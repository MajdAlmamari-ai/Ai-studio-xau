/**
 * DataValidator — Ingress Quality & Outlier Detection
 * -----------------------------------------------------------------------------
 * Enforces institutional quality standards on raw candle data:
 * 1. OHLC existence and valid numbers.
 * 2. High >= Low.
 * 3. High >= max(Open, Close).
 * 4. Low <= min(Open, Close).
 * 5. Realistic XAU/USD price boundaries (500 to 10,000 USD/oz).
 * 6. Timestamps strictly valid (not in the future).
 * 7. Spike filter: rejection of candle if deviation > 10% from previous close.
 *
 * STRICT RULES:
 * - Deterministic validation.
 * - Deterministic validation without synthetic numbers.
 * - Throws DataUnavailableError with diagnostic code on invalid candle.
 */

import { RawCandle } from '../candleRepository';
import { DataUnavailableError } from '../../src/engine/enforcer/PriceSourceEnforcer';

export class DataValidator {
  /**
   * Validates a single candle against institutional standards and optional previous candle.
   * Throws DataUnavailableError if any check fails.
   */
  public static validateCandle(candle: RawCandle, previous: RawCandle | null = null): void {
    if (!candle) {
      throw new DataUnavailableError('NULL_CANDLE', 'Candle data is null or undefined');
    }

    const { time, open, high, low, close } = candle;

    // 1. OHLC Existence and NaN/Infinity check
    if (
      typeof time !== 'number' || isNaN(time) ||
      typeof open !== 'number' || isNaN(open) ||
      typeof high !== 'number' || isNaN(high) ||
      typeof low !== 'number' || isNaN(low) ||
      typeof close !== 'number' || isNaN(close)
    ) {
      throw new DataUnavailableError('INVALID_OHLC_VALUES', `Candle contains invalid or NaN OHLC values at time ${time}`);
    }

    // 2. High >= Low
    if (high < low) {
      throw new DataUnavailableError('HIGH_LESS_THAN_LOW', `High (${high}) is less than Low (${low}) at time ${time}`);
    }

    // 3. High >= max(Open, Close)
    const maxOC = Math.max(open, close);
    if (high < maxOC) {
      throw new DataUnavailableError('HIGH_VIOLATION', `High (${high}) is less than max(Open, Close) (${maxOC}) at time ${time}`);
    }

    // 4. Low <= min(Open, Close)
    const minOC = Math.min(open, close);
    if (low > minOC) {
      throw new DataUnavailableError('LOW_VIOLATION', `Low (${low}) is greater than min(Open, Close) (${minOC}) at time ${time}`);
    }

    // 5. Reasonable price range (500 to 10,000 for XAUUSD)
    if (open < 500 || open > 10000 || close < 500 || close > 10000 || high < 500 || high > 10000 || low < 500 || low > 10000) {
      throw new DataUnavailableError('PRICE_OUT_OF_BOUNDS', `Price out of reasonable Gold boundaries (500-10000): O=${open}, H=${high}, L=${low}, C=${close}`);
    }

    // 6. Timestamp not in future (allow 5-minute buffer for network clock skew)
    const nowSec = Math.floor(Date.now() / 1000) + 300;
    if (time > nowSec) {
      throw new DataUnavailableError('TIMESTAMP_IN_FUTURE', `Candle timestamp ${time} is in the future (current ${nowSec})`);
    }

    // 7. Spike detection (> 10% change from previous candle close)
    if (previous && typeof previous.close === 'number' && previous.close > 0) {
      const pctChange = Math.abs(open - previous.close) / previous.close;
      if (pctChange > 0.10) {
        throw new DataUnavailableError('SPIKE_DETECTED', `Candle open ${open} deviates ${(pctChange * 100).toFixed(2)}% (>10%) from previous close ${previous.close}`);
      }
    }
  }
}
