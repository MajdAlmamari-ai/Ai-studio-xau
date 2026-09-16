/**
 * TradingView History Fetcher
 *
 * Fetches OHLCV history via TradingView WebSocket.
 * Uses chart_create_session + resolve_symbol + create_series.
 * Stores in CandleRepository.
 *
 * Protocol:
 *   Send: ~m~<len>~m~{"m":"chart_create_session",...}
 *   Send: ~m~<len>~m~{"m":"resolve_symbol",...}
 *   Send: ~m~<len>~m~{"m":"create_series",...}
 *   Recv: timescale_update with bars
 *
 * Bar: [time, open, high, low, close, volume]
 *
 * Deterministic. NO Math.random.
 */

import WebSocket from 'ws';
import { CandleRepository } from '../repositories/candle.repository';

export interface HistoryFetchResult {
  symbol: string;
  timeframe: string;
  requestedBars: number;
  receivedBars: number;
  addedBars: number;
  updatedBars: number;
  totalBarsInDb: number;
  fetchedAt: number;
  durationMs: number;
}

export interface HistoryFetchError {
  code: string;
  shortAr: string;
  detailsAr: string;
  howToFix: string[];
}

export type HistoryFetchOutcome =
  | { ok: true; data: HistoryFetchResult }
  | { ok: false; error: HistoryFetchError };

const WS_URL = 'wss://data.tradingview.com/socket.io/websocket';

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Origin: 'https://www.tradingview.com',
  'Accept-Language': 'en-US,en;q=0.9',
};

const TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1d': '1D',
  '1w': '1W',
};

function frame(obj: unknown): string {
  const json = JSON.stringify(obj);
  return `~m~${json.length}~m~${json}`;
}

function heartbeatReply(hb: string): string {
  return `~m~${hb.length}~m~${hb}`;
}

interface ParsedBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export class TvHistoryFetcher {
  private readonly repo: CandleRepository;
  private readonly timeoutMs: number;

  constructor(repo: CandleRepository, timeoutMs = 30000) {
    this.repo = repo;
    this.timeoutMs = timeoutMs;
  }

  async fetchHistory(
    symbol: string,
    timeframe: string,
    barCount = 5000,
  ): Promise<HistoryFetchOutcome> {
    const started = Date.now();
    const tvTf = TIMEFRAME_MAP[timeframe];
    if (!tvTf) {
      return {
        ok: false,
        error: {
          code: 'INVALID_TIMEFRAME',
          shortAr: 'الإطار الزمني غير مدعوم',
          detailsAr: `Supported: ${Object.keys(TIMEFRAME_MAP).join(', ')}`,
          howToFix: ['اختر إطاراً مدعوماً'],
        },
      };
    }

    const bars = await this.fetchBarsFromTv(symbol, tvTf, barCount);
    if (bars.ok === false) {
      return { ok: false, error: bars.error };
    }

    if (bars.data.length === 0) {
      return {
        ok: false,
        error: {
          code: 'NO_BARS_RECEIVED',
          shortAr: 'لم يتم استلام أي شموع',
          detailsAr: `Symbol: ${symbol}, TF: ${timeframe}`,
          howToFix: ['تحقق من الرمز', 'أعد المحاولة'],
        },
      };
    }

    const ingest = this.repo.ingestCandles(
      symbol,
      timeframe,
      'tradingview',
      bars.data,
    );

    return {
      ok: true,
      data: {
        symbol,
        timeframe,
        requestedBars: barCount,
        receivedBars: bars.data.length,
        addedBars: ingest.added,
        updatedBars: ingest.updated,
        totalBarsInDb: ingest.total,
        fetchedAt: Date.now(),
        durationMs: Date.now() - started,
      },
    };
  }

  async fetchDelta(
    symbol: string,
    timeframe: string,
    lookbackBars = 500,
  ): Promise<HistoryFetchOutcome> {
    const lastBarTime = this.repo.getLatestBarTime(symbol, timeframe);
    if (lastBarTime === null) {
      // No history in DB → fetch full
      return this.fetchHistory(symbol, timeframe, lookbackBars);
    }

    const tvTf = TIMEFRAME_MAP[timeframe];
    if (!tvTf) {
      return {
        ok: false,
        error: {
          code: 'INVALID_TIMEFRAME',
          shortAr: 'الإطار غير مدعوم',
          detailsAr: `Supported: ${Object.keys(TIMEFRAME_MAP).join(', ')}`,
          howToFix: ['اختر إطاراً مدعوماً'],
        },
      };
    }

    const bars = await this.fetchBarsFromTv(symbol, tvTf, lookbackBars);
    if (bars.ok === false) {
      return { ok: false, error: bars.error };
    }

    // Filter only bars newer than lastBarTime
    const newBars = bars.data.filter((b) => b.time > lastBarTime);
    if (newBars.length === 0) {
      return {
        ok: true,
        data: {
          symbol,
          timeframe,
          requestedBars: lookbackBars,
          receivedBars: bars.data.length,
          addedBars: 0,
          updatedBars: 0,
          totalBarsInDb: this.repo.count(symbol, timeframe),
          fetchedAt: Date.now(),
          durationMs: 0,
        },
      };
    }

    const ingest = this.repo.ingestCandles(
      symbol,
      timeframe,
      'tradingview',
      newBars,
    );

    return {
      ok: true,
      data: {
        symbol,
        timeframe,
        requestedBars: lookbackBars,
        receivedBars: bars.data.length,
        addedBars: ingest.added,
        updatedBars: ingest.updated,
        totalBarsInDb: ingest.total,
        fetchedAt: Date.now(),
        durationMs: 0,
      },
    };
  }

  private fetchBarsFromTv(
    symbol: string,
    tvTf: string,
    barCount: number,
  ): Promise<{ ok: true; data: ParsedBar[] } | { ok: false; error: HistoryFetchError }> {
    return new Promise((resolve) => {
      const ws = new WebSocket(WS_URL, { headers: HEADERS });
      const chartSession = `cs_${Date.now()}`;
      const seriesId = `sds_1`;

      let resolved = false;
      const finish = (
        result: { ok: true; data: ParsedBar[] } | { ok: false; error: HistoryFetchError },
      ) => {
        if (resolved) return;
        resolved = true;
        try {
          ws.close();
        } catch {
          // ignore
        }
        resolve(result);
      };

      const timeout = setTimeout(() => {
        finish({
          ok: false,
          error: {
            code: 'HISTORY_TIMEOUT',
            shortAr: 'انتهت مهلة جلب التاريخ',
            detailsAr: `Timeout after ${this.timeoutMs}ms`,
            howToFix: ['أعد المحاولة', 'تحقق من الاتصال'],
          },
        });
      }, this.timeoutMs);

      ws.on('open', () => {
        // Auth token setup
        ws.send(
          frame({
            m: 'set_auth_token',
            p: ['unauthorized_user_token'],
          }),
        );

        // 1. Create chart session
        ws.send(
          frame({
            m: 'chart_create_session',
            p: [chartSession, ''],
          }),
        );

        // 2. Resolve symbol
        setTimeout(() => {
          ws.send(
            frame({
              m: 'resolve_symbol',
              p: [
                chartSession,
                'symbol_1',
                `={"symbol":"${symbol}","adjustment":"splits","session":"regular"}`,
              ],
            }),
          );
        }, 200);

        // 3. Create series
        setTimeout(() => {
          ws.send(
            frame({
              m: 'create_series',
              p: [
                chartSession,
                seriesId,
                's1',
                'symbol_1',
                tvTf,
                barCount,
                '',
              ],
            }),
          );
        }, 500);
      });

      const bars: ParsedBar[] = [];

      ws.on('message', (data) => {
        const str = data.toString();

        // Handle heartbeat
        if (str.includes('~h~')) {
          const match = str.match(/~h~(\d+)/);
          if (match) ws.send(`~m~${match[0].length}~m~${match[0]}`);
          return;
        }

        // Look for timescale_update or series_completed
        if (str.includes('timescale_update')) {
          try {
            const parts = str.split(/~m~\d+~m~/).filter(Boolean);
            for (const part of parts) {
              if (part.startsWith('~h~')) continue;
              const obj = JSON.parse(part);
              if (obj.m === 'timescale_update' && Array.isArray(obj.p)) {
                const dataObj = obj.p[1];
                if (dataObj && typeof dataObj === 'object') {
                  const series = (dataObj as any)[seriesId];
                  if (series && Array.isArray(series.s)) {
                    for (const bar of series.s) {
                      const v = bar.v;
                      if (Array.isArray(v) && v.length >= 5) {
                        const [t, o, h, l, c, vol] = v;
                        if (
                          typeof t === 'number' &&
                          typeof o === 'number' &&
                          typeof h === 'number' &&
                          typeof l === 'number' &&
                          typeof c === 'number'
                        ) {
                          bars.push({
                            time: Math.floor(t),
                            open: o,
                            high: h,
                            low: l,
                            close: c,
                            volume: typeof vol === 'number' ? vol : null,
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch {
            // parse error, ignore
          }
        }

        if (str.includes('series_completed')) {
          clearTimeout(timeout);
          finish({ ok: true, data: bars });
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        finish({
          ok: false,
          error: {
            code: 'TV_WS_ERROR',
            shortAr: 'فشل الاتصال بـ TradingView',
            detailsAr: err.message,
            howToFix: ['أعد المحاولة', 'تحقق من الاتصال'],
          },
        });
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (!resolved) {
          // Closed without completion — return what we have
          if (bars.length > 0) {
            finish({ ok: true, data: bars });
          } else {
            finish({
              ok: false,
              error: {
                code: 'TV_WS_CLOSED',
                shortAr: 'أُغلق الاتصال قبل الاستلام',
                detailsAr: 'Closed without series_completed',
                howToFix: ['أعد المحاولة'],
              },
            });
          }
        }
      });
    });
  }
}
