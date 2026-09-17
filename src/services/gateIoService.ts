import type { 
  GateIoMarketOverview, 
  GateIoSpotMasterOverview,
  GateIoSpotTradeFlow,
  GateIoSpotTicker, 
  GateIoFuturesTicker, 
  NormalizedCandle, 
  GateIoOrderBookData 
} from '../types/sharedTypes';

export type { 
  GateIoMarketOverview, 
  GateIoSpotMasterOverview,
  GateIoSpotTradeFlow,
  GateIoSpotTicker, 
  GateIoFuturesTicker, 
  NormalizedCandle, 
  GateIoOrderBookData 
};

let cachedClientOverview: GateIoMarketOverview | null = null;
const cachedCandlesMap: Record<string, NormalizedCandle[]> = {};

/**
 * Fetch Consolidated Gate.io Market Overview (Spot PAXG + Futures XAU + Spread & Depth)
 * Resilient against temporary offline / network hiccup / server restart.
 */
export async function fetchGateIoOverview(force = false): Promise<GateIoMarketOverview> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`/api/gateio/overview${force ? '?force=true' : ''}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.spot && data.futures && data.orderBook) {
        cachedClientOverview = data;
        return data;
      }
    }
  } catch (_err) {
    // Transient network abort or server restarting
  }

  if (cachedClientOverview) {
    return cachedClientOverview;
  }

  throw Object.assign(
    new Error('GATEIO_UNAVAILABLE: Gate.io is not the primary source. Use TradingView /api/tv/* endpoints instead.'),
    {
      code: 'GATEIO_UNAVAILABLE',
      shortAr: 'Gate.io غير متاح',
      detailsAr: 'Gate.io ليس المصدر الأساسي. استخدم TradingView.',
      howToFix: ['تحقق من TradingView relay', 'أعد المحاولة'],
    },
  );
}

/**
 * Fetch Dedicated Gate.io XAU/USD Spot Master Overview (Ticker, OrderBook, Trades, CVD)
 */
export async function fetchGateIoSpotMasterClient(force = false): Promise<GateIoSpotMasterOverview> {
  const res = await fetch(`/api/gateio/spot/master${force ? '?force=true' : ''}`);
  if (!res.ok) {
    throw new Error(`Gate.io Spot Master failed: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch Live Trades & CVD directly from Gate.io Spot API (PAXG_USDT)
 */
export async function fetchGateIoSpotTradesClient(limit = 30): Promise<GateIoSpotTradeFlow> {
  const res = await fetch(`/api/gateio/spot/trades?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Gate.io Spot Trades failed: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch Historical and Live Candlesticks from Gate.io
 * @param market 'spot' (PAXG_USDT) | 'futures' (XAU_USDT)
 * @param interval '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d'
 * @param limit number of candles (default 60)
 */
export async function fetchGateIoCandlesticksClient(
  market: 'spot' | 'futures' = 'spot',
  interval: string = '1h',
  limit: number = 60
): Promise<NormalizedCandle[]> {
  const cacheKey = `${market}_${interval}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`/api/gateio/candlesticks?market=${market}&interval=${interval}&limit=${limit}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.candles) && data.candles.length > 0) {
        cachedCandlesMap[cacheKey] = data.candles;
        return data.candles;
      }
    }
  } catch (_err) {
    // Transient network abort or server restarting
  }

  return cachedCandlesMap[cacheKey] || [];
}

export const fetchGateIoCandlesticks = fetchGateIoCandlesticksClient;

/**
 * Apply Gate.io Live Price directly as the active reference for SMC Quant calculations
 */
export async function applyGateIoPriceToEngine(
  price: number,
  source: 'spot' | 'futures' = 'spot'
): Promise<{ success: boolean; appliedPrice: number; messageAr: string }> {
  const res = await fetch('/api/gateio/apply-to-engine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price, source }),
  });
  if (!res.ok) {
    throw new Error(`Failed to apply Gate.io price: ${res.statusText}`);
  }
  return res.json();
}
