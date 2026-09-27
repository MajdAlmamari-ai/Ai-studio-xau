/**
 * Candle Repository
 *
 * Persistence for OHLCV candles in SQLite.
 * Portable interface (can be swapped for PostgreSQL later).
 *
 * NO Math.random.
 * NO fake data.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ALL_TIMEFRAMES, Timeframe, TV_RESOLUTION_TO_TIMEFRAME } from '../src/constants/timeframes';
import { PriceSourceEnforcer } from '../src/engine/enforcer/PriceSourceEnforcer';
import {
  SpotCandle,
  FuturesCandle,
} from '../src/engine/types/branded';

export function normalizeToCanonicalTimeframe(tf: string): Timeframe {
  // Map legacy TV resolutions (e.g. '1', '5', '15', '30', '60', '240', '1D', '1W')
  if (TV_RESOLUTION_TO_TIMEFRAME[tf]) {
    return TV_RESOLUTION_TO_TIMEFRAME[tf];
  }
  // Support case-insensitive canonical strings
  const lower = tf.toLowerCase();
  if (ALL_TIMEFRAMES.includes(lower as Timeframe)) {
    return lower as Timeframe;
  }
  if (ALL_TIMEFRAMES.includes(tf as Timeframe)) {
    return tf as Timeframe;
  }
  throw new Error(`Invalid non-canonical timeframe: "${tf}". Allowed: ${ALL_TIMEFRAMES.join(', ')}`);
}

export type CandleSource = 'SPOT' | 'FUTURES' | 'UNKNOWN';
export type SupportedSymbol = 'OANDA:XAUUSD' | 'COMEX:GC1!';
export type CandleDataType = 'SPOT' | 'FUTURES';

export interface RawCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  openInterest?: number | null;
}

export interface CandleRecord {
  symbol: string;
  timeframe: Timeframe | string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  source: string;
  ingested_at: number;
}

export interface FetchState {
  data_type: CandleDataType;
  timeframe: Timeframe | string;
  last_bar_time: number;
  last_fetch_at: number;
  total_bars: number;
  last_source: string;
  // Backward compatibility alias
  symbol?: string;
}

export interface IngestResult {
  added: number;
  updated: number;
  total: number;
}

export class CandleRepository {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS spot_candles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timeframe TEXT NOT NULL,
        time INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL,
        source TEXT NOT NULL DEFAULT 'SPOT',
        ingested_at INTEGER NOT NULL,
        UNIQUE(timeframe, time)
      );

      CREATE INDEX IF NOT EXISTS idx_spot_candles_lookup
        ON spot_candles(timeframe, time DESC);

      CREATE TABLE IF NOT EXISTS futures_candles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timeframe TEXT NOT NULL,
        time INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL,
        open_interest REAL,
        source TEXT NOT NULL DEFAULT 'FUTURES',
        ingested_at INTEGER NOT NULL,
        UNIQUE(timeframe, time)
      );

      CREATE INDEX IF NOT EXISTS idx_futures_candles_lookup
        ON futures_candles(timeframe, time DESC);
    `);

    // Migration and cleanup
    this.migrateAndUpgradeSchema();
  }

  private migrateAndUpgradeSchema(): void {
    // Drop legacy table if present
    this.db.exec(`DROP TABLE IF EXISTS candles;`);

    // 2. Upgrade fetch_state table to (data_type, timeframe)
    this.upgradeFetchStateTable();
  }

  private upgradeFetchStateTable(): void {
    const tableInfo = this.db.prepare(`PRAGMA table_info(fetch_state)`).all() as Array<{ name: string }>;
    const hasDataTypeCol = tableInfo.some((col) => col.name === 'data_type');

    if (tableInfo.length === 0) {
      // Table doesn't exist yet
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS fetch_state (
          data_type TEXT NOT NULL,
          timeframe TEXT NOT NULL,
          last_bar_time INTEGER NOT NULL,
          last_fetch_at INTEGER NOT NULL,
          total_bars INTEGER NOT NULL DEFAULT 0,
          last_source TEXT NOT NULL,
          PRIMARY KEY (data_type, timeframe)
        );
      `);
    } else if (!hasDataTypeCol) {
      // Migrate legacy fetch_state (symbol, timeframe) -> (data_type, timeframe)
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS fetch_state_new (
          data_type TEXT NOT NULL,
          timeframe TEXT NOT NULL,
          last_bar_time INTEGER NOT NULL,
          last_fetch_at INTEGER NOT NULL,
          total_bars INTEGER NOT NULL DEFAULT 0,
          last_source TEXT NOT NULL,
          PRIMARY KEY (data_type, timeframe)
        );

        INSERT OR REPLACE INTO fetch_state_new (data_type, timeframe, last_bar_time, last_fetch_at, total_bars, last_source)
        SELECT 
          CASE 
            WHEN symbol = 'COMEX:GC1!' THEN 'FUTURES'
            WHEN symbol = 'OANDA:XAUUSD' THEN 'SPOT'
            ELSE 'FUTURES'
          END as data_type,
          timeframe,
          last_bar_time,
          last_fetch_at,
          total_bars,
          last_source
        FROM fetch_state;

        DROP TABLE fetch_state;
        ALTER TABLE fetch_state_new RENAME TO fetch_state;
      `);
    }
  }

  // ---------------------------------------------------------------------------------------
  // ACTION 6.2: Spot & Futures Dedicated Methods
  // ---------------------------------------------------------------------------------------

  getSpotCandles(timeframe: string, limit?: number): SpotCandle[];
  getSpotCandles(symbol: string, timeframe: string, limit: number): CandleRecord[];
  getSpotCandles(arg1: string, arg2?: string | number, arg3?: number): SpotCandle[] | CandleRecord[] {
    let timeframe: string;
    let limit: number;
    let isSymbolCall = false;
    let symbol = 'OANDA:XAUUSD';

    if (typeof arg2 === 'string') {
      // getSpotCandles(symbol, timeframe, limit)
      symbol = arg1;
      timeframe = arg2;
      limit = typeof arg3 === 'number' ? arg3 : 100;
      isSymbolCall = true;
    } else {
      // getSpotCandles(timeframe, limit)
      timeframe = arg1;
      limit = typeof arg2 === 'number' ? arg2 : 100;
    }

    const canonicalTf = normalizeToCanonicalTimeframe(timeframe);
    const stmt = this.db.prepare(`
      SELECT time, open, high, low, close, volume, source, ingested_at
      FROM spot_candles
      WHERE timeframe = ?
      ORDER BY time DESC
      LIMIT ?
    `);
    const rows = stmt.all(canonicalTf, limit) as Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number | null;
      source: string;
      ingested_at: number;
    }>;
    const result = rows.reverse();

    if (isSymbolCall) {
      return result.map((r) => {
        const spot = PriceSourceEnforcer.enforceSpot({
          time: r.time,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          volume: r.volume ?? 0,
          source: 'SPOT',
        });
        return {
          symbol,
          timeframe: canonicalTf,
          time: spot.time,
          open: spot.open,
          high: spot.high,
          low: spot.low,
          close: spot.close,
          volume: spot.volume,
          source: 'SPOT',
          ingested_at: r.ingested_at || Date.now(),
        };
      });
    }

    return result.map((r) =>
      PriceSourceEnforcer.enforceSpot({
        time: r.time,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume ?? 0,
        source: 'SPOT',
      })
    );
  }

  saveSpotCandles(timeframe: string, candles: RawCandle[] | Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>): number;
  saveSpotCandles(symbol: string, timeframe: string, candles: RawCandle[]): number;
  saveSpotCandles(
    arg1: string,
    arg2: string | RawCandle[] | Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>,
    arg3?: RawCandle[]
  ): number {
    let timeframe: string;
    let candles: RawCandle[] | Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;

    if (typeof arg2 === 'string') {
      timeframe = arg2;
      candles = arg3 || [];
    } else {
      timeframe = arg1;
      candles = arg2 || [];
    }

    if (candles.length === 0) return 0;
    const canonicalTf = normalizeToCanonicalTimeframe(timeframe);
    const now = Date.now();

    for (const c of candles) {
      PriceSourceEnforcer.enforceSpot({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
        source: 'SPOT',
      });
    }

    const stmtSpot = this.db.prepare(`
      INSERT INTO spot_candles (timeframe, time, open, high, low, close, volume, source, ingested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'SPOT', ?)
      ON CONFLICT(timeframe, time) DO UPDATE SET
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        source = 'SPOT',
        ingested_at = excluded.ingested_at
    `);

    const tx = this.db.transaction((items: typeof candles) => {
      for (const c of items) {
        stmtSpot.run(canonicalTf, c.time, c.open, c.high, c.low, c.close, c.volume ?? 0, now);
      }
    });

    tx(candles);
    return candles.length;
  }

  countSpotCandles(symbolOrTf: string, tf?: string): number {
    const timeframe = tf || symbolOrTf;
    return this.count('SPOT', timeframe);
  }

  getFuturesCandles(timeframe: string, limit?: number): FuturesCandle[];
  getFuturesCandles(symbol: string, timeframe: string, limit: number): CandleRecord[];
  getFuturesCandles(arg1: string, arg2?: string | number, arg3?: number): FuturesCandle[] | CandleRecord[] {
    let timeframe: string;
    let limit: number;
    let isSymbolCall = false;
    let symbol = 'COMEX:GC1!';

    if (typeof arg2 === 'string') {
      // getFuturesCandles(symbol, timeframe, limit)
      symbol = arg1;
      timeframe = arg2;
      limit = typeof arg3 === 'number' ? arg3 : 100;
      isSymbolCall = true;
    } else {
      // getFuturesCandles(timeframe, limit)
      timeframe = arg1;
      limit = typeof arg2 === 'number' ? arg2 : 100;
    }

    const canonicalTf = normalizeToCanonicalTimeframe(timeframe);
    const stmt = this.db.prepare(`
      SELECT time, open, high, low, close, volume, open_interest as openInterest, source, ingested_at
      FROM futures_candles
      WHERE timeframe = ?
      ORDER BY time DESC
      LIMIT ?
    `);
    const rows = stmt.all(canonicalTf, limit) as Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number | null;
      openInterest?: number | null;
      source: string;
      ingested_at: number;
    }>;
    const result = rows.reverse();

    if (isSymbolCall) {
      return result.map((r) => {
        const futures = PriceSourceEnforcer.enforceFutures({
          time: r.time,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          volume: r.volume ?? 0,
          openInterest: r.openInterest ?? undefined,
          source: 'FUTURES',
        });
        return {
          symbol,
          timeframe: canonicalTf,
          time: futures.time,
          open: futures.open,
          high: futures.high,
          low: futures.low,
          close: futures.close,
          volume: futures.volume,
          source: 'FUTURES',
          ingested_at: r.ingested_at || Date.now(),
        };
      });
    }

    return result.map((r) =>
      PriceSourceEnforcer.enforceFutures({
        time: r.time,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume ?? 0,
        openInterest: r.openInterest ?? undefined,
        source: 'FUTURES',
      })
    );
  }

  saveFuturesCandles(timeframe: string, candles: RawCandle[] | Array<{ time: number; open: number; high: number; low: number; close: number; volume: number; openInterest?: number }>): number;
  saveFuturesCandles(symbol: string, timeframe: string, candles: RawCandle[]): number;
  saveFuturesCandles(
    arg1: string,
    arg2: string | RawCandle[] | Array<{ time: number; open: number; high: number; low: number; close: number; volume: number; openInterest?: number }>,
    arg3?: RawCandle[]
  ): number {
    let timeframe: string;
    let candles: RawCandle[] | Array<{ time: number; open: number; high: number; low: number; close: number; volume: number; openInterest?: number }>;

    if (typeof arg2 === 'string') {
      timeframe = arg2;
      candles = arg3 || [];
    } else {
      timeframe = arg1;
      candles = arg2 || [];
    }

    if (candles.length === 0) return 0;
    const canonicalTf = normalizeToCanonicalTimeframe(timeframe);
    const now = Date.now();

    for (const c of candles) {
      PriceSourceEnforcer.enforceFutures({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
        openInterest: c.openInterest ?? undefined,
        source: 'FUTURES',
      });
    }

    const stmtFutures = this.db.prepare(`
      INSERT INTO futures_candles (timeframe, time, open, high, low, close, volume, open_interest, source, ingested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'FUTURES', ?)
      ON CONFLICT(timeframe, time) DO UPDATE SET
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        open_interest = excluded.open_interest,
        source = 'FUTURES',
        ingested_at = excluded.ingested_at
    `);

    const tx = this.db.transaction((items: typeof candles) => {
      for (const c of items) {
        stmtFutures.run(canonicalTf, c.time, c.open, c.high, c.low, c.close, c.volume ?? 0, c.openInterest ?? null, now);
      }
    });

    tx(candles);
    return candles.length;
  }

  countFuturesCandles(symbolOrTf: string, tf?: string): number {
    const timeframe = tf || symbolOrTf;
    return this.count('FUTURES', timeframe);
  }

  // ---------------------------------------------------------------------------------------
  // Ingest & Lookup (Split Table Routing)
  // ---------------------------------------------------------------------------------------

  ingestCandles(
    symbol: string,
    timeframe: string,
    source: string,
    candles: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number | null;
    }>,
  ): IngestResult {
    const canonicalTf = normalizeToCanonicalTimeframe(timeframe);
    if (candles.length === 0) {
      return { added: 0, updated: 0, total: 0 };
    }

    const now = Date.now();
    const isFutures = symbol === 'COMEX:GC1!' || (!symbol.includes('XAU') && !symbol.includes('SPOT'));
    const dataType: CandleDataType = isFutures ? 'FUTURES' : 'SPOT';

    const countBefore = this.count(symbol, canonicalTf);

    if (dataType === 'FUTURES') {
      const stmtFutures = this.db.prepare(`
        INSERT INTO futures_candles (timeframe, time, open, high, low, close, volume, source, ingested_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'FUTURES', ?)
        ON CONFLICT(timeframe, time) DO UPDATE SET
          open = excluded.open,
          high = excluded.high,
          low = excluded.low,
          close = excluded.close,
          volume = excluded.volume,
          source = 'FUTURES',
          ingested_at = excluded.ingested_at
      `);

      const tx = this.db.transaction((items: typeof candles) => {
        for (const c of items) {
          stmtFutures.run(canonicalTf, c.time, c.open, c.high, c.low, c.close, c.volume ?? 0, now);
        }
      });
      tx(candles);
    } else {
      const stmtSpot = this.db.prepare(`
        INSERT INTO spot_candles (timeframe, time, open, high, low, close, volume, source, ingested_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'SPOT', ?)
        ON CONFLICT(timeframe, time) DO UPDATE SET
          open = excluded.open,
          high = excluded.high,
          low = excluded.low,
          close = excluded.close,
          volume = excluded.volume,
          source = 'SPOT',
          ingested_at = excluded.ingested_at
      `);

      const tx = this.db.transaction((items: typeof candles) => {
        for (const c of items) {
          stmtSpot.run(canonicalTf, c.time, c.open, c.high, c.low, c.close, c.volume ?? 0, now);
        }
      });
      tx(candles);
    }

    const countAfter = this.count(symbol, canonicalTf);
    const added = Math.max(0, countAfter - countBefore);
    const updated = Math.max(0, candles.length - added);

    const lastBar = candles.reduce((max, c) => (c.time > max ? c.time : max), 0);

    this.upsertFetchState({
      data_type: dataType,
      timeframe: canonicalTf,
      last_bar_time: lastBar,
      last_fetch_at: now,
      total_bars: countAfter,
      last_source: source,
      symbol,
    });

    return { added, updated, total: countAfter };
  }

  getLatestCandles(symbol: string, timeframe: string, limit: number): CandleRecord[] {
    const canonicalTf = normalizeToCanonicalTimeframe(timeframe);
    if (symbol === 'OANDA:XAUUSD' || symbol.includes('XAU')) {
      const spot = this.getSpotCandles(canonicalTf, limit);
      return spot.map((s) => ({
        symbol: 'OANDA:XAUUSD',
        timeframe: canonicalTf,
        time: s.time,
        open: s.open,
        high: s.high,
        low: s.low,
        close: s.close,
        volume: s.volume,
        source: 'SPOT',
        ingested_at: Date.now(),
      }));
    }

    // Default to futures
    const futures = this.getFuturesCandles(canonicalTf, limit);
    return futures.map((f) => ({
      symbol: 'COMEX:GC1!',
      timeframe: canonicalTf,
      time: f.time,
      open: f.open,
      high: f.high,
      low: f.low,
      close: f.close,
      volume: f.volume,
      source: 'FUTURES',
      ingested_at: Date.now(),
    }));
  }

  getLatestBarTime(symbolOrDataType: string, timeframe: string): number | null {
    const canonicalTf = normalizeToCanonicalTimeframe(timeframe);
    const isSpot = symbolOrDataType === 'SPOT' || symbolOrDataType === 'OANDA:XAUUSD' || symbolOrDataType.includes('XAU');
    const table = isSpot ? 'spot_candles' : 'futures_candles';

    const stmt = this.db.prepare(`
      SELECT time FROM ${table}
      WHERE timeframe = ?
      ORDER BY time DESC LIMIT 1
    `);
    const row = stmt.get(canonicalTf) as { time: number } | undefined;
    return row?.time ?? null;
  }

  count(symbolOrDataType: string, timeframe: string): number {
    const canonicalTf = normalizeToCanonicalTimeframe(timeframe);
    const isSpot = symbolOrDataType === 'SPOT' || symbolOrDataType === 'OANDA:XAUUSD' || symbolOrDataType.includes('XAU');
    const table = isSpot ? 'spot_candles' : 'futures_candles';

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as n FROM ${table}
      WHERE timeframe = ?
    `);
    const row = stmt.get(canonicalTf) as { n: number };
    return row.n;
  }

  getFetchState(dataTypeOrSymbol: CandleDataType | string, timeframe: string): FetchState | null {
    const canonicalTf = normalizeToCanonicalTimeframe(timeframe);
    const dataType: CandleDataType =
      dataTypeOrSymbol === 'SPOT' || dataTypeOrSymbol === 'OANDA:XAUUSD' || dataTypeOrSymbol.includes('XAU')
        ? 'SPOT'
        : 'FUTURES';

    const stmt = this.db.prepare(`
      SELECT * FROM fetch_state
      WHERE data_type = ? AND timeframe = ?
    `);
    const row = stmt.get(dataType, canonicalTf) as FetchState | undefined;
    if (!row) return null;
    return {
      ...row,
      symbol: dataType === 'SPOT' ? 'OANDA:XAUUSD' : 'COMEX:GC1!',
    };
  }

  upsertFetchState(state: FetchState | { symbol: string; timeframe: string; last_bar_time: number; last_fetch_at: number; total_bars: number; last_source: string; data_type?: CandleDataType }): void {
    const canonicalTf = normalizeToCanonicalTimeframe(state.timeframe);
    const dataType: CandleDataType =
      state.data_type ||
      (state.symbol === 'OANDA:XAUUSD' || (state.symbol && state.symbol.includes('XAU')) ? 'SPOT' : 'FUTURES');

    const stmt = this.db.prepare(`
      INSERT INTO fetch_state (data_type, timeframe, last_bar_time, last_fetch_at, total_bars, last_source)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(data_type, timeframe) DO UPDATE SET
        last_bar_time = excluded.last_bar_time,
        last_fetch_at = excluded.last_fetch_at,
        total_bars = excluded.total_bars,
        last_source = excluded.last_source
    `);
    stmt.run(
      dataType,
      canonicalTf,
      state.last_bar_time,
      state.last_fetch_at,
      state.total_bars,
      state.last_source,
    );
  }

  close(): void {
    this.db.close();
  }
}
