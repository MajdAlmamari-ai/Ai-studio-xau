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

/**
 * Fetch Consolidated Gate.io Market Overview (Spot PAXG + Futures XAU + Spread & Depth)
 */
export async function fetchGateIoOverview(force = false): Promise<GateIoMarketOverview> {
  const res = await fetch(`/api/gateio/overview${force ? '?force=true' : ''}`);
  if (!res.ok) {
    throw new Error(`Gate.io Overview failed: ${res.statusText}`);
  }
  return res.json();
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
  const res = await fetch(`/api/gateio/candlesticks?market=${market}&interval=${interval}&limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Gate.io Candlesticks failed: ${res.statusText}`);
  }
  const data = await res.json();
  return data.candles || [];
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
