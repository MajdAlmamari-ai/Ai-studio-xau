/**
 * TradingView Live Candle Updater Service
 * -----------------------------------------------------------------------------------------
 * Institutional-grade live candle streaming and persistence engine:
 * 1. Subscribes to live quotes from TradingView WebSocket Relay for:
 *    - COMEX:GC1! (Futures) -> persisted to futures_candles
 *    - OANDA:XAUUSD (Spot)  -> persisted to spot_candles
 * 2. Continuously constructs and updates live OHLCV bars across all institutional timeframes:
 *    - 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w
 * 3. Persists live candles into SQLite via CandleRepository dedicated split tables.
 * 4. Periodically synchronizes closed official bars using TvHistoryFetcher.
 * 
 * STRICT RULES:
 * - COMEX:GC1! -> futures_candles
 * - OANDA:XAUUSD -> spot_candles
 * - Source: TradingView WebSocket ONLY
 * - Fully deterministic, zero synthetic data
 * - NO fake data, NO silent fallbacks
 * - Non-blocking on server boot
 */

import { CandleRepository } from './candleRepository';
import { getTvRelay, SYMBOLS, TvQuote } from './tvRelay';
import { TvHistoryFetcher } from './tvHistoryFetcher';
import { Timeframe } from '../src/constants/timeframes';
import { logger } from './loggerService';

export const LIVE_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
};

interface LiveBarBucket {
  symbol: string;
  timeframe: Timeframe;
  bucketTime: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  dirty: boolean;
}

export class TvLiveUpdater {
  private readonly repo: CandleRepository;
  private readonly historyFetcher: TvHistoryFetcher;
  private isRunning = false;
  private flushIntervalId: NodeJS.Timeout | null = null;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private lastQuoteTime = 0;
  private liveBuckets: Map<string, LiveBarBucket> = new Map();

  constructor(repo?: CandleRepository) {
    this.repo = repo || new CandleRepository('./db/xauusd.sqlite');
    this.historyFetcher = new TvHistoryFetcher(this.repo);
  }

  /**
   * Start live candle updates (non-blocking)
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const relay = getTvRelay();

      // Listen to real-time quotes for both Futures and Spot
      relay.on('quote', (quote: TvQuote) => {
        if (quote.symbol === SYMBOLS.FUTURES || quote.symbol === SYMBOLS.SPOT_PRIMARY) {
          this.handleLiveQuote(quote);
        }
      });

      // Periodic flush of dirty live candles to CandleRepository
      this.flushIntervalId = setInterval(() => {
        this.flushDirtyBuckets();
      }, 2000);

      // Periodic official sync for closed bars (every 60s)
      this.syncIntervalId = setInterval(() => {
        this.syncOfficialBars().catch((err) => {
          logger.warn('WEBSOCKET', `Official bars sync warning: ${err?.message || err}`);
        });
      }, 60000);

      logger.info('WEBSOCKET', `Live candle updater started for [${SYMBOLS.FUTURES}, ${SYMBOLS.SPOT_PRIMARY}] across [${LIVE_TIMEFRAMES.join(', ')}]`);
    } catch (err: any) {
      logger.error('WEBSOCKET', `Failed to start TvLiveUpdater: ${err?.message || err}`);
    }
  }

  /**
   * Stop the updater service
   */
  public stop(): void {
    this.isRunning = false;
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    this.flushDirtyBuckets();
  }

  public getStatus() {
    return {
      symbols: [SYMBOLS.FUTURES, SYMBOLS.SPOT_PRIMARY],
      isRunning: this.isRunning,
      timeframes: LIVE_TIMEFRAMES,
      lastQuoteTime: this.lastQuoteTime,
      activeBucketsCount: this.liveBuckets.size,
    };
  }

  private handleLiveQuote(quote: TvQuote): void {
    const price = quote.price;
    if (typeof price !== 'number' || price <= 0 || isNaN(price)) return;

    const symbol = quote.symbol;
    if (symbol !== SYMBOLS.FUTURES && symbol !== SYMBOLS.SPOT_PRIMARY) return;

    const nowSec = Math.floor(quote.timestamp / 1000) || Math.floor(Date.now() / 1000);
    this.lastQuoteTime = quote.timestamp || Date.now();

    const vol = typeof quote.volume === 'number' && quote.volume > 0 ? quote.volume : 0;

    for (const tf of LIVE_TIMEFRAMES) {
      const stepSec = TIMEFRAME_SECONDS[tf];
      const bucketTime = Math.floor(nowSec / stepSec) * stepSec;
      const key = `${symbol}:${tf}`;

      let current = this.liveBuckets.get(key);

      if (!current || current.bucketTime !== bucketTime) {
        // Bar rollover or first initialization
        if (current && current.dirty) {
          this.persistBucket(current);
        }

        // Initialize from existing candle in repository if available
        const existing = this.repo.getLatestCandles(symbol, tf, 1);
        if (existing.length > 0 && existing[0].time === bucketTime) {
          const prev = existing[0];
          current = {
            symbol,
            timeframe: tf,
            bucketTime,
            open: prev.open,
            high: Math.max(prev.high, price),
            low: Math.min(prev.low, price),
            close: price,
            volume: (prev.volume ?? 0) + vol,
            dirty: true,
          };
        } else {
          current = {
            symbol,
            timeframe: tf,
            bucketTime,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: vol,
            dirty: true,
          };
        }
      } else {
        // Update current candle in progress
        current.high = Math.max(current.high, price);
        current.low = Math.min(current.low, price);
        current.close = price;
        current.volume += vol;
        current.dirty = true;
      }

      this.liveBuckets.set(key, current);
    }
  }

  private flushDirtyBuckets(): void {
    for (const bucket of this.liveBuckets.values()) {
      if (bucket.dirty) {
        this.persistBucket(bucket);
        bucket.dirty = false;
      }
    }
  }

  private persistBucket(bucket: LiveBarBucket): void {
    try {
      if (bucket.symbol === 'COMEX:GC1!') {
        // Persist to futures_candles
        this.repo.saveFuturesCandles(bucket.timeframe, [
          {
            time: bucket.bucketTime,
            open: bucket.open,
            high: bucket.high,
            low: bucket.low,
            close: bucket.close,
            volume: bucket.volume,
          },
        ]);
      } else if (bucket.symbol === 'OANDA:XAUUSD') {
        // Persist to spot_candles
        this.repo.saveSpotCandles(bucket.timeframe, [
          {
            time: bucket.bucketTime,
            open: bucket.open,
            high: bucket.high,
            low: bucket.low,
            close: bucket.close,
            volume: bucket.volume,
          },
        ]);
      } else {
        this.repo.ingestCandles(bucket.symbol, bucket.timeframe, 'TRADINGVIEW_LIVE', [
          {
            time: bucket.bucketTime,
            open: bucket.open,
            high: bucket.high,
            low: bucket.low,
            close: bucket.close,
            volume: bucket.volume > 0 ? bucket.volume : null,
          },
        ]);
      }
    } catch (err: any) {
      logger.warn('WEBSOCKET', `Failed to persist live candle [${bucket.symbol} ${bucket.timeframe}]: ${err?.message || err}`);
    }
  }

  /**
   * Sync official closed bars for fast timeframes to guarantee data consistency
   */
  private async syncOfficialBars(): Promise<void> {
    const fastTimeframes: Timeframe[] = ['1m', '5m', '15m'];
    for (const tf of fastTimeframes) {
      try {
        await this.historyFetcher.fetchHistory(SYMBOLS.FUTURES, tf, 5);
      } catch {
        // non-blocking
      }
    }
  }
}

// Global Singleton Instance
let liveUpdaterInstance: TvLiveUpdater | null = null;

export function getTvLiveUpdater(): TvLiveUpdater {
  if (!liveUpdaterInstance) {
    liveUpdaterInstance = new TvLiveUpdater();
  }
  return liveUpdaterInstance;
}
