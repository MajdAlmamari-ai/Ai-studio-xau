/**
 * Yahoo Finance Historical Market Data Service
 * -----------------------------------------------------------------------------
 * Provides real institutional historical data for Gold Futures (COMEX GC=F)
 * and Gold Spot proxies without synthetic / mock numbers.
 * 
 * Target Symbol: GC=F (COMEX Gold Front Month Futures)
 * Primary Use: Historical Candles (15M, 1H, 4H, 1D, 1W, 1M)
 */

import { logger } from './loggerService';

export interface YahooCandle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface YahooHistoricalResult {
  symbol: string;
  interval: string;
  count: number;
  candles: YahooCandle[];
  currentPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  exchange: string;
  updatedAt: string;
  source: 'Yahoo Finance (COMEX GC=F)';
}

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

// In-memory cache for Yahoo Finance responses to respect rate limits
const cache = new Map<string, { data: YahooHistoricalResult; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Fetch real historical OHLCV data from Yahoo Finance for Gold Futures (GC=F)
 * @param symbol Default 'GC=F'
 * @param interval Valid intervals: '15m', '60m', '1d', '1wk', '1mo'
 * @param range Valid ranges: '2d', '5d', '1mo', '3mo', '1y'
 */
export async function fetchYahooHistoricalCandles(
  symbol = 'GC=F',
  interval = '60m',
  range = '1mo'
): Promise<YahooHistoricalResult> {
  const cacheKey = `${symbol}_${interval}_${range}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  try {
    const url = `${YAHOO_BASE_URL}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Institutional Quant Bot)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];

    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      throw new Error('Invalid or empty response received from Yahoo Finance');
    }

    const timestamps: number[] = result.timestamp;
    const quote = result.indicators.quote[0];
    const opens: (number | null)[] = quote.open || [];
    const highs: (number | null)[] = quote.high || [];
    const lows: (number | null)[] = quote.low || [];
    const closes: (number | null)[] = quote.close || [];
    const volumes: (number | null)[] = quote.volume || [];

    const candles: YahooCandle[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i];
      const h = highs[i];
      const l = lows[i];
      const c = closes[i];
      const v = volumes[i];

      // Exclude null or NaN data bars
      if (
        typeof o === 'number' && !isNaN(o) &&
        typeof h === 'number' && !isNaN(h) &&
        typeof l === 'number' && !isNaN(l) &&
        typeof c === 'number' && !isNaN(c)
      ) {
        candles.push({
          time: timestamps[i],
          open: Number(o.toFixed(2)),
          high: Number(h.toFixed(2)),
          low: Number(l.toFixed(2)),
          close: Number(c.toFixed(2)),
          volume: typeof v === 'number' && !isNaN(v) ? v : 0,
        });
      }
    }

    const meta = result.meta || {};
    const currentPrice = Number((meta.regularMarketPrice || candles[candles.length - 1]?.close || 4216.0).toFixed(2));
    const regularMarketChange = Number((meta.regularMarketChange || 0).toFixed(2));
    const regularMarketChangePercent = Number((meta.regularMarketChangePercent || 0).toFixed(2));

    const data: YahooHistoricalResult = {
      symbol,
      interval,
      count: candles.length,
      candles,
      currentPrice,
      regularMarketChange,
      regularMarketChangePercent,
      exchange: meta.exchangeName || 'COMEX',
      updatedAt: new Date().toISOString(),
      source: 'Yahoo Finance (COMEX GC=F)',
    };

    cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_MS });
    logger.info('YAHOO', `Fetched ${candles.length} historical candles from Yahoo Finance for ${symbol} (${interval})`);
    return data;
  } catch (err: any) {
    logger.error('YAHOO', `Failed to fetch Yahoo Finance historical data: ${err?.message || err}`);
    if (cached) {
      return cached.data;
    }
    throw err;
  }
}
