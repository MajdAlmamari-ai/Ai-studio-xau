/**
 * TradingView Relay REST API
 *
 * Exposes the tvRelay service via HTTP.
 *
 * Endpoints:
 *   GET /api/tv/quotes        → all quotes
 *   GET /api/tv/quote/:key    → single quote by key
 *   GET /api/tv/basis         → computed basis
 *   GET /api/tv/state         → relay status
 *   GET /api/tv/health        → health check
 */

import { Router, Request, Response } from 'express';
import { getTvRelay, SYMBOLS, SymbolValue } from './tvRelay';

export const tvRouter = Router();

const SYMBOL_KEYS: Record<string, SymbolValue> = {
  futures: SYMBOLS.FUTURES,
  spot: SYMBOLS.SPOT_PRIMARY,
  spot_alt: SYMBOLS.SPOT_ALT,
  cfd: SYMBOLS.CFD_ALT,
};

tvRouter.get('/quotes', (_req: Request, res: Response) => {
  const relay = getTvRelay();
  const quotes = relay.getAllQuotes();
  res.json({
    ok: true,
    count: quotes.length,
    quotes,
    fetchedAt: Date.now(),
  });
});

tvRouter.get('/quote/:key', (req: Request, res: Response) => {
  const key = String(req.params.key);
  const symbol = SYMBOL_KEYS[key];
  if (!symbol) {
    res.status(400).json({
      ok: false,
      error: `Invalid key: ${key}. Valid keys: ${Object.keys(SYMBOL_KEYS).join(', ')}`,
    });
    return;
  }
  const relay = getTvRelay();
  const quote = relay.getQuote(symbol);
  if (!quote) {
    res.status(404).json({
      ok: false,
      error: `No quote available for ${symbol}`,
    });
    return;
  }
  res.json({ ok: true, quote, fetchedAt: Date.now() });
});

tvRouter.get('/basis', (_req: Request, res: Response) => {
  const relay = getTvRelay();
  const basis = relay.getBasis();
  res.json({ ok: true, basis, fetchedAt: Date.now() });
});

tvRouter.get('/state', (_req: Request, res: Response) => {
  const relay = getTvRelay();
  res.json({ ok: true, state: relay.getState(), fetchedAt: Date.now() });
});

tvRouter.get('/health', (_req: Request, res: Response) => {
  const relay = getTvRelay();
  const state = relay.getState();
  const quoteFresh = typeof (relay as any).isQuoteFresh === 'function' ? (relay as any).isQuoteFresh(30000) : false;
  const healthy = state.status === 'CONNECTED' && state.quoteUpdates > 0;
  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    status: state.status,
    messagesReceived: state.messagesReceived,
    quoteUpdates: state.quoteUpdates,
    heartbeatsReceived: state.heartbeatsReceived,
    quoteFresh,
    lastMessageAt: state.lastMessageAt,
    lastError: state.lastError,
    fetchedAt: Date.now(),
  });
});
