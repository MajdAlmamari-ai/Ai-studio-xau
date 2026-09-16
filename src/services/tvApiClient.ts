/**
 * TradingView API Client (Frontend)
 *
 * Calls /api/tv/* endpoints.
 *
 * Endpoints:
 *   GET /api/tv/quotes
 *   GET /api/tv/quote/:key
 *   GET /api/tv/basis
 *   GET /api/tv/state
 *   GET /api/tv/health
 *
 * NO Math.random.
 * NO fake data.
 */

export type TvSymbolKey = 'futures' | 'spot' | 'spot_alt' | 'cfd';

export interface TvQuoteResponse {
  ok: true;
  quote: {
    symbol: string;
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
  };
  fetchedAt: number;
}

export interface TvAllQuotesResponse {
  ok: true;
  count: number;
  quotes: TvQuoteResponse['quote'][];
  fetchedAt: number;
}

export interface TvBasisResponse {
  ok: true;
  basis: {
    futures: number | null;
    spot: number | null;
    basis: number | null;
    basisPct: number | null;
    computedAt: number;
  };
  fetchedAt: number;
}

export interface TvStateResponse {
  ok: true;
  state: {
    status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'FAILED';
    sessionId: string;
    connectedAt: number | null;
    lastMessageAt: number | null;
    messagesReceived: number;
    heartbeatsReceived: number;
    quoteUpdates: number;
    reconnects: number;
    lastError: string | null;
    subscribedSymbols: string[];
  };
  fetchedAt: number;
}

export interface TvErrorReason {
  code: string;
  shortAr: string;
  detailsAr: string;
  howToFix: string[];
}

export type TvResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: TvErrorReason };

const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTvQuote(key: TvSymbolKey): Promise<TvResult<TvQuoteResponse['quote']>> {
  try {
    const res = await fetchWithTimeout(`/api/tv/quote/${key}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        reason: {
          code: `TV_API_HTTP_${res.status}`,
          shortAr: `TradingView API أعاد HTTP ${res.status}`,
          detailsAr: body?.error || res.statusText,
          howToFix: ['أعد المحاولة بعد دقيقة'],
        },
      };
    }
    const data: TvQuoteResponse = await res.json();
    return { ok: true, data: data.quote };
  } catch (err: any) {
    return {
      ok: false,
      reason: {
        code: 'TV_API_NETWORK_ERROR',
        shortAr: 'فشل الاتصال بـ TradingView API',
        detailsAr: String(err?.message || 'Unknown'),
        howToFix: ['تحقق من الاتصال', 'أعد المحاولة'],
      },
    };
  }
}

export async function fetchTvAllQuotes(): Promise<TvResult<TvQuoteResponse['quote'][]>> {
  try {
    const res = await fetchWithTimeout('/api/tv/quotes');
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        reason: {
          code: `TV_API_HTTP_${res.status}`,
          shortAr: `TV API HTTP ${res.status}`,
          detailsAr: body?.error || res.statusText,
          howToFix: ['أعد المحاولة'],
        },
      };
    }
    const data: TvAllQuotesResponse = await res.json();
    return { ok: true, data: data.quotes };
  } catch (err: any) {
    return {
      ok: false,
      reason: {
        code: 'TV_API_NETWORK_ERROR',
        shortAr: 'فشل الاتصال',
        detailsAr: String(err?.message || 'Unknown'),
        howToFix: ['تحقق من الاتصال'],
      },
    };
  }
}

export async function fetchTvBasis(): Promise<TvResult<TvBasisResponse['basis']>> {
  try {
    const res = await fetchWithTimeout('/api/tv/basis');
    if (!res.ok) {
      return {
        ok: false,
        reason: {
          code: `TV_BASIS_HTTP_${res.status}`,
          shortAr: `Basis HTTP ${res.status}`,
          detailsAr: res.statusText,
          howToFix: ['أعد المحاولة'],
        },
      };
    }
    const data: TvBasisResponse = await res.json();
    return { ok: true, data: data.basis };
  } catch (err: any) {
    return {
      ok: false,
      reason: {
        code: 'TV_BASIS_NETWORK_ERROR',
        shortAr: 'فشل Basis',
        detailsAr: String(err?.message || 'Unknown'),
        howToFix: ['تحقق من الاتصال'],
      },
    };
  }
}

export async function fetchTvState(): Promise<TvResult<TvStateResponse['state']>> {
  try {
    const res = await fetchWithTimeout('/api/tv/state');
    if (!res.ok) {
      return {
        ok: false,
        reason: {
          code: `TV_STATE_HTTP_${res.status}`,
          shortAr: `State HTTP ${res.status}`,
          detailsAr: res.statusText,
          howToFix: ['أعد المحاولة'],
        },
      };
    }
    const data: TvStateResponse = await res.json();
    return { ok: true, data: data.state };
  } catch (err: any) {
    return {
      ok: false,
      reason: {
        code: 'TV_STATE_NETWORK_ERROR',
        shortAr: 'فشل State',
        detailsAr: String(err?.message || 'Unknown'),
        howToFix: ['تحقق من الاتصال'],
      },
    };
  }
}
