-- XAUUSD SMC Quant — Database Schema
-- Version: 1.0.0

-- ============================================================
-- CANDLES TABLE
-- Stores OHLCV candles from all sources (TradingView, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS candles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  time INTEGER NOT NULL,           -- Unix seconds (bar open time)
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL,                     -- nullable (some sources lack it)
  source TEXT NOT NULL,            -- 'tradingview', 'yahoo', 'gateio'
  ingested_at INTEGER NOT NULL,    -- Unix ms (when we stored it)
  UNIQUE(symbol, timeframe, time)
);

CREATE INDEX IF NOT EXISTS idx_candles_lookup
  ON candles(symbol, timeframe, time DESC);

CREATE INDEX IF NOT EXISTS idx_candles_source
  ON candles(source);

-- ============================================================
-- SPOT CANDLES TABLE (Dedicated OANDA:XAUUSD)
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_candles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL DEFAULT 'OANDA:XAUUSD',
  timeframe TEXT NOT NULL,
  open_time INTEGER NOT NULL,
  close_time INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL,
  is_closed INTEGER NOT NULL DEFAULT 1,
  ingested_at INTEGER NOT NULL,
  UNIQUE(symbol, timeframe, open_time)
);

CREATE INDEX IF NOT EXISTS idx_spot_candles_lookup
  ON spot_candles(symbol, timeframe, open_time DESC);

-- ============================================================
-- FUTURES CANDLES TABLE (Dedicated COMEX:GC1!)
-- ============================================================

CREATE TABLE IF NOT EXISTS futures_candles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL DEFAULT 'COMEX:GC1!',
  timeframe TEXT NOT NULL,
  open_time INTEGER NOT NULL,
  close_time INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL,
  open_interest REAL,
  is_closed INTEGER NOT NULL DEFAULT 1,
  ingested_at INTEGER NOT NULL,
  UNIQUE(symbol, timeframe, open_time)
);

CREATE INDEX IF NOT EXISTS idx_futures_candles_lookup
  ON futures_candles(symbol, timeframe, open_time DESC);

-- ============================================================
-- FETCH STATE TABLE
-- Tracks the last fetched bar per (symbol, timeframe)
-- ============================================================

CREATE TABLE IF NOT EXISTS fetch_state (
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  last_bar_time INTEGER NOT NULL,   -- Unix seconds
  last_fetch_at INTEGER NOT NULL,   -- Unix ms
  total_bars INTEGER NOT NULL DEFAULT 0,
  last_source TEXT NOT NULL,
  PRIMARY KEY (symbol, timeframe)
);

-- ============================================================
-- AUDIT LOG
-- Records all data operations for traceability
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,          -- 'INGEST', 'DELTA', 'PRUNE', 'VERIFY'
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  bars_added INTEGER NOT NULL DEFAULT 0,
  bars_updated INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  status TEXT NOT NULL,             -- 'SUCCESS', 'FAILED', 'PARTIAL'
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_symbol_tf
  ON audit_log(symbol, timeframe, started_at DESC);
