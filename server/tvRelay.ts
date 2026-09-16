/**
 * TradingView Relay Service
 *
 * Persistent WebSocket connection to TradingView.
 * Streams real-time data for:
 *   - COMEX:GC1!   (Gold Futures - COMEX)
 *   - OANDA:XAUUSD (Gold Spot)
 *   - FX_IDC:XAUUSD (Gold Spot alternative)
 *   - TVC:GOLD     (Gold CFD alternative)
 *
 * Protocol:
 *   - URL: wss://data.tradingview.com/socket.io/websocket
 *   - Frame: ~m~<len>~m~<json>
 *   - Messages: qsd with lp, bid, ask, volume
 *   - Heartbeat: ~m~4~m~~h~1
 *
 * Architecture:
 *   - Singleton
 *   - Auto-reconnect with exponential backoff
 *   - EventEmitter for subscribers
 *   - In-memory cache of latest quotes
 *
 * NO Math.random.
 * NO fake data.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'node:events';

export const SYMBOLS = {
  FUTURES: 'COMEX:GC1!',
  SPOT_PRIMARY: 'OANDA:XAUUSD',
  SPOT_ALT: 'FX_IDC:XAUUSD',
  CFD_ALT: 'TVC:GOLD',
} as const;

export type SymbolKey = keyof typeof SYMBOLS;
export type SymbolValue = typeof SYMBOLS[SymbolKey];

export interface TvQuote {
  symbol: SymbolValue;
  price: number;
  bid: number | null;
  ask: number | null;
  bidSize: number | null;
  askSize: number | null;
  volume: number | null;
  change: number | null;
  changePct: number | null;
  timestamp: number;
  receivedAt: number;
  ageMs: number;
}

export interface TvBasis {
  futures: number | null;
  spot: number | null;
  basis: number | null;
  basisPct: number | null;
  computedAt: number;
}

export type RelayStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'FAILED';

export interface RelayState {
  status: RelayStatus;
  sessionId: string;
  connectedAt: number | null;
  lastMessageAt: number | null;
  messagesReceived: number;
  heartbeatsReceived: number;
  quoteUpdates: number;
  reconnects: number;
  lastError: string | null;
  subscribedSymbols: SymbolValue[];
}

const WS_URL = 'wss://data.tradingview.com/socket.io/websocket';

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Origin: 'https://www.tradingview.com',
  'Accept-Language': 'en-US,en;q=0.9',
};

const ALL_SYMBOLS: SymbolValue[] = [
  SYMBOLS.FUTURES,
  SYMBOLS.SPOT_PRIMARY,
  SYMBOLS.SPOT_ALT,
  SYMBOLS.CFD_ALT,
];

function frame(obj: unknown): string {
  const json = JSON.stringify(obj);
  return `~m~${json.length}~m~${json}`;
}

function heartbeatReply(hb: string): string {
  return `~m~${hb.length}~m~${hb}`;
}

export class TvRelay extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly sessionId: string;
  private quotes: Map<SymbolValue, TvQuote> = new Map();
  private state: RelayState;
  private reconnectAttempt = 0;
  private readonly maxReconnectDelay = 60000;
  private stopped = false;
  private startupTimers: NodeJS.Timeout[] = [];

  constructor() {
    super();
    this.setMaxListeners(50);
    this.sessionId = `qs_${Date.now()}`;
    this.state = {
      status: 'DISCONNECTED',
      sessionId: this.sessionId,
      connectedAt: null,
      lastMessageAt: null,
      messagesReceived: 0,
      heartbeatsReceived: 0,
      quoteUpdates: 0,
      reconnects: 0,
      lastError: null,
      subscribedSymbols: [],
    };
  }

  start(): void {
    if (this.ws && this.state.status === 'CONNECTED') return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    for (const t of this.startupTimers) clearTimeout(t);
    this.startupTimers = [];
    if (this.ws) {
      this.ws.removeAllListeners();
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.state.status = 'DISCONNECTED';
    this.state.connectedAt = null;
  }

  getState(): RelayState {
    return { ...this.state, subscribedSymbols: [...this.state.subscribedSymbols] };
  }

  getQuote(symbol: SymbolValue): TvQuote | null {
    const q = this.quotes.get(symbol);
    return q ? { ...q } : null;
  }

  isQuoteFresh(maxAgeMs = 30000): boolean {
    if (this.state.status !== 'CONNECTED') return false;
    const now = Date.now();
    for (const quote of this.quotes.values()) {
      if (now - quote.receivedAt <= maxAgeMs) {
        return true;
      }
    }
    return false;
  }

  getAllQuotes(): TvQuote[] {
    return Array.from(this.quotes.values()).map((q) => ({ ...q }));
  }

  getBasis(): TvBasis {
    const fut = this.quotes.get(SYMBOLS.FUTURES);
    const spot = this.quotes.get(SYMBOLS.SPOT_PRIMARY);
    if (!fut || !spot) {
      return {
        futures: fut?.price ?? null,
        spot: spot?.price ?? null,
        basis: null,
        basisPct: null,
        computedAt: Date.now(),
      };
    }
    const basis = fut.price - spot.price;
    const basisPct = spot.price !== 0 ? (basis / spot.price) * 100 : null;
    return {
      futures: fut.price,
      spot: spot.price,
      basis,
      basisPct,
      computedAt: Date.now(),
    };
  }

  private connect(): void {
    this.state.status = this.reconnectAttempt > 0 ? 'RECONNECTING' : 'CONNECTING';

    try {
      this.ws = new WebSocket(WS_URL, { headers: HEADERS });
    } catch (err) {
      this.state.lastError = String(err);
      this.state.status = 'FAILED';
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => this.onOpen());
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('error', (err) => this.onError(err));
    this.ws.on('close', (code, reason) => this.onClose(code, reason));
  }

  private onOpen(): void {
    this.state.status = 'CONNECTED';
    this.state.connectedAt = Date.now();
    this.reconnectAttempt = 0;
    this.emit('connected');

    // Step 1: create quote session
    this.send(frame({ m: 'quote_create_session', p: [this.sessionId] }));

    // Step 2: add all symbols
    const t1 = setTimeout(() => {
      this.send(
        frame({
          m: 'quote_add_symbols',
          p: [this.sessionId, ...ALL_SYMBOLS],
        }),
      );
      this.state.subscribedSymbols = [...ALL_SYMBOLS];
    }, 400);

    // Step 3: subscribe to fast updates
    const t2 = setTimeout(() => {
      this.send(frame({ m: 'quote_fast_symbols', p: [this.sessionId, ...ALL_SYMBOLS] }));
    }, 900);

    this.startupTimers.push(t1, t2);
  }

  private send(msg: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    }
  }

  private onMessage(data: WebSocket.RawData): void {
    this.state.messagesReceived++;
    this.state.lastMessageAt = Date.now();

    const str = data.toString();

    // Handle heartbeat
    if (str.includes('~h~')) {
      this.state.heartbeatsReceived++;
      const match = str.match(/~h~(\d+)/);
      if (match) this.send(`~m~${match[0].length}~m~${match[0]}`);
      return;
    }

    this.parseMessage(str);
  }

  private parseMessage(str: string): void {
    const parts = str.split(/~m~\d+~m~/).filter(Boolean);

    for (const part of parts) {
      if (part.startsWith('~h~')) continue;

      try {
        const obj = JSON.parse(part);
        this.handleObject(obj);
      } catch {
        // Not JSON, skip
      }
    }
  }

  private handleObject(obj: any): void {
    if (obj.m !== 'qsd') return;
    if (!Array.isArray(obj.p) || obj.p.length < 2) return;

    // TradingView format: p: [sessionId, { n: symbol, s: 'ok', v: { lp: 123, ... } }]
    // or p: [sessionId, symbol, payload]
    let symbol: string | undefined;
    let v: Record<string, unknown> | undefined;

    if (typeof obj.p[1] === 'object' && obj.p[1] !== null) {
      symbol = obj.p[1].n;
      v = obj.p[1].v;
    } else if (typeof obj.p[1] === 'string' && typeof obj.p[2] === 'object') {
      symbol = obj.p[1];
      v = obj.p[2]?.v ?? obj.p[2];
    }

    if (!symbol || typeof symbol !== 'string') return;
    if (!this.isKnownSymbol(symbol)) return;
    if (!v || typeof v !== 'object') return;

    this.mergeQuote(symbol as SymbolValue, v);
  }

  private isKnownSymbol(s: string): s is SymbolValue {
    return (ALL_SYMBOLS as readonly string[]).includes(s);
  }

  private mergeQuote(symbol: SymbolValue, v: Record<string, unknown>): void {
    const existing = this.quotes.get(symbol);
    const now = Date.now();

    const pick = (key: string, fallback: number | null): number | null => {
      const val = v[key];
      if (typeof val === 'number' && Number.isFinite(val)) return val;
      return fallback;
    };

    const price = pick('lp', existing?.price ?? null);
    if (price === null) {
      // no price in this update, and no previous price
      return;
    }

    const quote: TvQuote = {
      symbol,
      price,
      bid: pick('bid', existing?.bid ?? null),
      ask: pick('ask', existing?.ask ?? null),
      bidSize: pick('bid_size', existing?.bidSize ?? null),
      askSize: pick('ask_size', existing?.askSize ?? null),
      volume: pick('volume', existing?.volume ?? null),
      change: pick('ch', existing?.change ?? null),
      changePct: pick('chp', existing?.changePct ?? null),
      timestamp: now,
      receivedAt: now,
      ageMs: 0,
    };

    this.quotes.set(symbol, quote);
    this.state.quoteUpdates++;
    this.emit('quote', quote);
  }

  private onError(err: Error): void {
    this.state.lastError = err.message;
    this.emit('error', err);
  }

  private onClose(code: number, reason: Buffer): void {
    this.state.status = 'DISCONNECTED';
    this.state.connectedAt = null;
    this.emit('disconnected', { code, reason: reason.toString() });

    if (!this.stopped) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt++;
    this.state.reconnects++;

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt - 1),
      this.maxReconnectDelay,
    );

    const t = setTimeout(() => {
      if (!this.stopped) {
        this.connect();
      }
    }, delay);
    this.startupTimers.push(t);
  }
}

// Singleton
let instance: TvRelay | null = null;

export function getTvRelay(): TvRelay {
  if (!instance) {
    instance = new TvRelay();
  }
  return instance;
}
