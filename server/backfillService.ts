/**
 * TradingView Initial Backfill Service
 * -----------------------------------------------------------------------------------------
 * Institutional-grade initial historical data population:
 * 1. Executes on server boot (non-blocking).
 * 2. Checks local CandleRepository for minimum required historical bars:
 *    - 1m: 5000 candles
 *    - 5m: 5000 candles
 *    - 15m: 4000 candles
 *    - 30m: 3000 candles
 *    - 1h: 1000 candles
 *    - 4h: 1000 candles
 *    - 1d: 200 candles
 *    - 1w: 52 candles
 * 3. Fetches missing history directly from TradingView WebSocket via TvHistoryFetcher.
 * 4. Persists directly into SQLite database (db/xauusd.sqlite).
 * 
 * STRICT RULES:
 * - Symbol: COMEX:GC1! ONLY
 * - Source: TradingView ONLY
 * - Fully deterministic, zero synthetic data
 * - NO placeholder values, NO external sources
 * - Log + continue if insufficient after fetch (no fake data)
 * - Throw DataUnavailableError on hard failures
 */

import { CandleRepository } from './candleRepository';
import { TvHistoryFetcher, HistoryFetchError } from './tvHistoryFetcher';
import { Timeframe } from '../src/constants/timeframes';
import { SYMBOLS } from './tvRelay';
import { logger } from './loggerService';
import { DataUnavailableError } from './priceVolumeEngine';

export const BACKFILL_TARGETS: Record<Timeframe, number> = {
  '1m': 5000,
  '5m': 5000,
  '15m': 4000,
  '30m': 3000,
  '1h': 1000,
  '4h': 1000,
  '1d': 200,
  '1w': 52,
};

export interface BackfillSummary {
  symbol: string;
  timeframe: Timeframe;
  targetCount: number;
  initialCount: number;
  finalCount: number;
  status: 'SUFFICIENT' | 'BACKFILLED' | 'PARTIAL' | 'FAILED';
  error?: string;
}

export async function runInitialBackfill(
  customRepo?: CandleRepository,
): Promise<BackfillSummary[]> {
  const symbol = SYMBOLS.FUTURES; // COMEX:GC1! ONLY
  const repo = customRepo || new CandleRepository('./db/xauusd.sqlite');
  const fetcher = new TvHistoryFetcher(repo);

  logger.info('WEBSOCKET', `Starting initial history verification for ${symbol}...`);

  const results: BackfillSummary[] = [];
  const timeframes = Object.keys(BACKFILL_TARGETS) as Timeframe[];

  for (const tf of timeframes) {
    const target = BACKFILL_TARGETS[tf];
    let countBefore = 0;

    try {
      countBefore = repo.count(symbol, tf);
    } catch (err: any) {
      logger.error('SYSTEM', `Database access failed for ${symbol} [${tf}]: ${err?.message || err}`);
      throw new DataUnavailableError('DB_UNAVAILABLE', `Database error checking candles for ${tf}`);
    }

    if (countBefore >= target) {
      logger.info('WEBSOCKET', `Timeframe [${tf}] is fully populated: ${countBefore}/${target} bars.`);
      results.push({
        symbol,
        timeframe: tf,
        targetCount: target,
        initialCount: countBefore,
        finalCount: countBefore,
        status: 'SUFFICIENT',
      });
      continue;
    }

    logger.info('WEBSOCKET', `Timeframe [${tf}] has ${countBefore}/${target} bars. Fetching history from TradingView...`);

    try {
      const outcome = await fetcher.fetchHistory(symbol, tf, target);

      const countAfter = repo.count(symbol, tf);

      if (outcome.ok && countAfter >= target) {
        logger.info('WEBSOCKET', `Successfully backfilled [${tf}]: now ${countAfter}/${target} bars.`);
        results.push({
          symbol,
          timeframe: tf,
          targetCount: target,
          initialCount: countBefore,
          finalCount: countAfter,
          status: 'BACKFILLED',
        });
      } else {
        let errorMsg = `Received ${countAfter} bars (target: ${target})`;
        if (!outcome.ok) {
          errorMsg = (outcome as { ok: false; error: HistoryFetchError }).error.detailsAr;
        }
        logger.warn('WEBSOCKET', `Timeframe [${tf}] partially filled: ${countAfter}/${target} bars. (${errorMsg})`);
        results.push({
          symbol,
          timeframe: tf,
          targetCount: target,
          initialCount: countBefore,
          finalCount: countAfter,
          status: 'PARTIAL',
          error: errorMsg,
        });
      }
    } catch (fetchErr: any) {
      const countAfter = repo.count(symbol, tf);
      logger.error('WEBSOCKET', `Failed to backfill [${tf}] from TradingView: ${fetchErr?.message || fetchErr}`);
      results.push({
        symbol,
        timeframe: tf,
        targetCount: target,
        initialCount: countBefore,
        finalCount: countAfter,
        status: 'FAILED',
        error: fetchErr?.message || String(fetchErr),
      });
    }
  }

  const successCount = results.filter((r) => r.status === 'SUFFICIENT' || r.status === 'BACKFILLED').length;
  logger.info('WEBSOCKET', `Initial backfill finished for ${symbol}: ${successCount}/${timeframes.length} timeframes ready.`);

  return results;
}
