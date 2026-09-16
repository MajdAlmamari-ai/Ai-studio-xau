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

export interface CandleRecord {
  symbol: string;
  timeframe: string;
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
  symbol: string;
  timeframe: string;
  last_bar_time: number;
  last_fetch_at: number;
  total_bars: number;
  last_source: string;
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
      CREATE TABLE IF NOT EXISTS candles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        time INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL,
        source TEXT NOT NULL,
        ingested_at INTEGER NOT NULL,
        UNIQUE(symbol, timeframe, time)
      );

      CREATE INDEX IF NOT EXISTS idx_candles_lookup
        ON candles(symbol, timeframe, time DESC);

      CREATE TABLE IF NOT EXISTS fetch_state (
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        last_bar_time INTEGER NOT NULL,
        last_fetch_at INTEGER NOT NULL,
        total_bars INTEGER NOT NULL DEFAULT 0,
        last_source TEXT NOT NULL,
        PRIMARY KEY (symbol, timeframe)
      );
    `);
  }

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
    if (candles.length === 0) {
      return { added: 0, updated: 0, total: 0 };
    }

    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO candles (symbol, timeframe, time, open, high, low, close, volume, source, ingested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, timeframe, time) DO UPDATE SET
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        source = excluded.source,
        ingested_at = excluded.ingested_at
    `);

    const countBefore = this.count(symbol, timeframe);

    const tx = this.db.transaction((items: typeof candles) => {
      for (const c of items) {
        stmt.run(
          symbol,
          timeframe,
          c.time,
          c.open,
          c.high,
          c.low,
          c.close,
          c.volume,
          source,
          now,
        );
      }
    });

    tx(candles);

    const countAfter = this.count(symbol, timeframe);
    const added = Math.max(0, countAfter - countBefore);
    const updated = Math.max(0, candles.length - added);

    const lastBar = candles.reduce((max, c) => (c.time > max ? c.time : max), 0);

    this.upsertFetchState({
      symbol,
      timeframe,
      last_bar_time: lastBar,
      last_fetch_at: now,
      total_bars: countAfter,
      last_source: source,
    });

    return { added, updated, total: countAfter };
  }

  getCandles(
    symbol: string,
    timeframe: string,
    fromTime: number,
    toTime: number,
    limit = 10000,
  ): CandleRecord[] {
    const stmt = this.db.prepare(`
      SELECT symbol, timeframe, time, open, high, low, close, volume, source, ingested_at
      FROM candles
      WHERE symbol = ? AND timeframe = ?
        AND time >= ? AND time <= ?
      ORDER BY time ASC
      LIMIT ?
    `);
    return stmt.all(symbol, timeframe, fromTime, toTime, limit) as CandleRecord[];
  }

  getLatestCandles(symbol: string, timeframe: string, limit: number): CandleRecord[] {
    const stmt = this.db.prepare(`
      SELECT symbol, timeframe, time, open, high, low, close, volume, source, ingested_at
      FROM candles
      WHERE symbol = ? AND timeframe = ?
      ORDER BY time DESC
      LIMIT ?
    `);
    const rows = stmt.all(symbol, timeframe, limit) as CandleRecord[];
    return rows.reverse();
  }

  getLatestBarTime(symbol: string, timeframe: string): number | null {
    const stmt = this.db.prepare(`
      SELECT time FROM candles
      WHERE symbol = ? AND timeframe = ?
      ORDER BY time DESC LIMIT 1
    `);
    const row = stmt.get(symbol, timeframe) as { time: number } | undefined;
    return row?.time ?? null;
  }

  count(symbol: string, timeframe: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as n FROM candles
      WHERE symbol = ? AND timeframe = ?
    `);
    const row = stmt.get(symbol, timeframe) as { n: number };
    return row.n;
  }

  getFetchState(symbol: string, timeframe: string): FetchState | null {
    const stmt = this.db.prepare(`
      SELECT * FROM fetch_state
      WHERE symbol = ? AND timeframe = ?
    `);
    const row = stmt.get(symbol, timeframe) as FetchState | undefined;
    return row ?? null;
  }

  upsertFetchState(state: FetchState): void {
    const stmt = this.db.prepare(`
      INSERT INTO fetch_state (symbol, timeframe, last_bar_time, last_fetch_at, total_bars, last_source)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, timeframe) DO UPDATE SET
        last_bar_time = excluded.last_bar_time,
        last_fetch_at = excluded.last_fetch_at,
        total_bars = excluded.total_bars,
        last_source = excluded.last_source
    `);
    stmt.run(
      state.symbol,
      state.timeframe,
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
