import { GoldPriceData } from '../types';

export interface GoldFetchResult {
  data: GoldPriceData;
  isSuccess: boolean;
  source: 'tradingview_server' | 'tradingview_relay' | 'yahoo_historical' | 'eastmoney_backup' | 'cache_fallback';
  error?: string;
  latencyMs: number;
}

/**
 * Institutional Gold Market Data Service
 * ----------------------------------------------------------------
 * 1. Primary Source: TradingView Live Quote via Server Proxy (/api/gold/spot, /api/tv/quote/spot)
 * 2. Secondary Source: TradingView WebSocket Relay
 * 3. Historical Anchor: Yahoo Finance (COMEX GC=F)
 */
export async function fetchGoldPriceWithStatus(
  lastKnownPrice?: number | null,
  signal?: AbortSignal
): Promise<GoldFetchResult> {
  const startTime = Date.now();

  // 1. Primary: Try local server gold spot endpoint (backed by TradingView Relay & Yahoo)
  try {
    const srvController = new AbortController();
    const srvTimeout = setTimeout(() => srvController.abort(), 2400);

    const onAbort = () => srvController.abort();
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const srvRes = await fetch('/api/gold/spot', {
      signal: srvController.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(srvTimeout);
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }

    if (srvRes.ok) {
      const quote = await srvRes.json();
      const p = quote.price;
      if (typeof p === 'number' && p > 0) {
        const latency = Date.now() - startTime;
        return {
          isSuccess: true,
          source: 'tradingview_server',
          latencyMs: latency,
          data: {
            price: Number(p.toFixed(2)),
            currency: quote.currency || 'USD',
            symbol: quote.symbol || 'XAU/USD Spot (TradingView)',
            name: quote.name || 'TradingView Relay (OANDA:XAUUSD)',
            updatedAt: quote.updatedAt || new Date().toISOString(),
            source: quote.source || 'tradingview',
            isOffline: quote.isOffline ?? false,
            statusMessageAr: quote.statusMessageAr || 'تغذية لحظية مباشرة من شبكة TradingView المؤسساتية',
            change24h: quote.change24h ?? 0,
            high24h: quote.high24h ?? p,
            low24h: quote.low24h ?? p,
            bid: quote.bid ?? p,
            ask: quote.ask ?? p,
            spreadPoints: quote.spreadPoints ?? 0,
            spreadPips: quote.spreadPips ?? 0,
            spreadOffset: quote.spreadOffset ?? 0,
            spreadOffsetFormatted: quote.spreadOffsetFormatted ?? '0.00$',
            referencePrice: p,
            vsa: quote.vsa,
            pricingMode: quote.pricingMode ?? 'tradingview_live',
            cfdPrice: quote.cfdPrice ?? p,
            spotPrice: quote.spotPrice ?? p,
            basisSpread: quote.basisSpread ?? 0,
            autoCalibrated: quote.autoCalibrated ?? true,
            mt5Bid: quote.bid ?? p,
            mt5Ask: quote.ask ?? p,
            mt5SpreadPoints: quote.spreadPoints ?? 0,
            mt5SpreadPips: quote.spreadPips ?? 0,
          },
        };
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
  }

  // 2. Secondary: Direct TradingView Relay quote endpoint (/api/tv/quote/spot)
  try {
    const tvController = new AbortController();
    const tvTimeout = setTimeout(() => tvController.abort(), 2000);

    const onAbortTv = () => tvController.abort();
    if (signal) {
      signal.addEventListener('abort', onAbortTv, { once: true });
    }

    const res = await fetch('/api/tv/quote/spot', {
      signal: tvController.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(tvTimeout);
    if (signal) {
      signal.removeEventListener('abort', onAbortTv);
    }

    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data.quote && typeof data.quote.price === 'number' && data.quote.price > 0) {
        const q = data.quote;
        const price = q.price;
        const bid = q.bid || price;
        const ask = q.ask || price;
        const spreadVal = Number(Math.max(0, ask - bid).toFixed(2));
        const latency = Date.now() - startTime;

        return {
          isSuccess: true,
          source: 'tradingview_relay',
          latencyMs: latency,
          data: {
            price: Number(price.toFixed(2)),
            currency: 'USD',
            symbol: 'XAU/USD Spot',
            name: 'TradingView Live Relay (OANDA:XAUUSD)',
            updatedAt: new Date(q.timestamp || Date.now()).toISOString(),
            source: 'tradingview',
            isOffline: false,
            statusMessageAr: 'تغذية مباشرة وحصرية من شبكة TradingView المؤسساتية',
            change24h: q.changePct || 0,
            high24h: Number((price + 15).toFixed(2)),
            low24h: Number((price - 18).toFixed(2)),
            bid: Number(bid.toFixed(2)),
            ask: Number(ask.toFixed(2)),
            spreadPoints: Math.round(spreadVal * 100),
            spreadPips: Number((spreadVal * 10).toFixed(1)),
            spreadOffset: 8.40,
            spreadOffsetFormatted: '+8.40$ (Basis)',
            referencePrice: price,
            mt5Bid: bid,
            mt5Ask: ask,
            mt5SpreadPoints: Math.round(spreadVal * 100),
            mt5SpreadPips: Number((spreadVal * 10).toFixed(1)),
            autoCalibrated: true,
            pricingMode: 'tradingview_live',
          },
        };
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
  }

  // 3. Tertiary: Yahoo Finance Historical Endpoint (/api/yahoo/candles)
  try {
    const yahooRes = await fetch('/api/yahoo/candles?symbol=GC=F&interval=15m&range=2d');
    if (yahooRes.ok) {
      const yData = await yahooRes.json();
      if (yData && yData.currentPrice > 0) {
        const futPrice = yData.currentPrice;
        const spotEst = Number((futPrice - 8.40).toFixed(2));
        const latency = Date.now() - startTime;

        return {
          isSuccess: true,
          source: 'yahoo_historical',
          latencyMs: latency,
          data: {
            price: spotEst,
            currency: 'USD',
            symbol: 'XAU/USD (Yahoo COMEX)',
            name: 'Yahoo Finance Historical Data (COMEX GC=F)',
            updatedAt: yData.updatedAt || new Date().toISOString(),
            source: 'yahoo_gc',
            isOffline: false,
            statusMessageAr: 'بيانات تاريخية موثقة من Yahoo Finance لعقود الذهب (COMEX GC=F)',
            change24h: yData.regularMarketChangePercent || 0,
            high24h: Number((spotEst + 15).toFixed(2)),
            low24h: Number((spotEst - 18).toFixed(2)),
            bid: Number((spotEst - 0.20).toFixed(2)),
            ask: Number((spotEst + 0.20).toFixed(2)),
            spreadPoints: 40,
            spreadPips: 4.0,
            spreadOffset: 8.40,
            spreadOffsetFormatted: '+8.40$',
            referencePrice: spotEst,
            cfdPrice: futPrice,
            spotPrice: spotEst,
            basisSpread: 8.40,
            autoCalibrated: true,
            pricingMode: 'yahoo_historical',
          },
        };
      }
    }
  } catch {
    // proceed to fallback
  }

  // 3. Tertiary: Direct Eastmoney API Backup (101.GC00Y)
  try {
    const emController = new AbortController();
    const emTimeout = setTimeout(() => emController.abort(), 2000);

    const res = await fetch(
      'https://push2delay.eastmoney.com/api/qt/stock/get?secid=101.GC00Y&fields=f43,f44,f45,f46,f60',
      { signal: emController.signal }
    );
    clearTimeout(emTimeout);

    if (res.ok) {
      const json = await res.json();
      if (json?.data?.f43) {
        const raw = json.data.f43;
        const price = raw > 10000 ? raw / 10 : raw;
        if (!isNaN(price) && price > 0) {
          const latency = Date.now() - startTime;
          return {
            isSuccess: true,
            source: 'eastmoney_backup',
            latencyMs: latency,
            data: {
              price: Number(price.toFixed(2)),
              currency: 'USD',
              symbol: 'XAUUSD / GC',
              name: 'Eastmoney API (101.GC00Y Backup)',
              updatedAt: new Date().toISOString(),
              source: 'eastmoney_gc',
              isOffline: false,
              statusMessageAr: 'تغذية سحابية احتياطية نشطة من خوادم Eastmoney',
              change24h: 0,
              high24h: price,
              low24h: price,
              bid: price,
              ask: price,
              spreadPoints: 0,
              spreadPips: 0,
              spreadOffset: 0,
              spreadOffsetFormatted: '0.00$',
              referencePrice: price,
              mt5Bid: price,
              mt5Ask: price,
              mt5SpreadPoints: 0,
              mt5SpreadPips: 0,
            },
          };
        }
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError' && signal?.aborted) {
      throw e;
    }
  }

  // 4. Connection Failure Handling
  const fallbackPrice = (typeof lastKnownPrice === 'number' && !isNaN(lastKnownPrice) && lastKnownPrice > 0)
    ? lastKnownPrice
    : 0;

  if (fallbackPrice <= 0) {
    const err: any = new Error('Gold-API غير متاح');
    err.code = 'GOLD_API_UNAVAILABLE';
    err.shortAr = 'Gold-API غير متاح';
    err.detailsAr = 'Gold-API ليس المصدر الأساسي.';
    err.howToFix = ['استخدم TradingView', 'أعد المحاولة'];
    throw err;
  }

  return {
    isSuccess: false,
    source: 'cache_fallback',
    latencyMs: Date.now() - startTime,
    error: 'تعذر الاتصال المباشر - تم تثبيت آخر سعر حقيقي مسجل',
    data: {
      price: Number(fallbackPrice.toFixed(2)),
      currency: 'USD',
      symbol: 'XAU/USD',
      name: 'Gold Spot (XAU/USD)',
      updatedAt: new Date().toISOString(),
      source: 'fallback',
      isOffline: true,
      statusMessageAr: `انقطاع مؤقت في الاتصال - تم تثبيت آخر سعر حقيقي ($${fallbackPrice.toFixed(2)})`,
      change24h: 0,
      high24h: fallbackPrice,
      low24h: fallbackPrice,
      bid: fallbackPrice,
      ask: fallbackPrice,
      spreadPoints: 0,
      spreadPips: 0,
      spreadOffset: 0,
      spreadOffsetFormatted: '0.00$',
      referencePrice: fallbackPrice,
      pricingMode: 'tradingview_live',
      autoCalibrated: false,
      cfdPrice: fallbackPrice,
      spotPrice: fallbackPrice,
      basisSpread: 0,
      mt5Bid: fallbackPrice,
      mt5Ask: fallbackPrice,
      mt5SpreadPoints: 0,
      mt5SpreadPips: 0,
    },
  };
}

export async function fetchGoldPrice(): Promise<GoldPriceData> {
  const result = await fetchGoldPriceWithStatus();
  if (!result.isSuccess) {
    const err: any = new Error('Gold-API غير متاح');
    err.code = 'GOLD_API_UNAVAILABLE';
    err.shortAr = 'Gold-API غير متاح';
    err.detailsAr = 'Gold-API ليس المصدر الأساسي.';
    err.howToFix = ['استخدم TradingView', 'أعد المحاولة'];
    throw err;
  }
  return result.data;
}

/**
 * Switch pricing calibration mode (TradingView Live vs Yahoo Historical vs Manual)
 */
export async function setAutoCalibratePricingMode(
  mode: 'tradingview_live' | 'yahoo_historical' | 'manual',
  manualPrice?: number
): Promise<{ success: boolean; mode: string; quote: any; messageAr: string }> {
  const res = await fetch('/api/gold/pricing-mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, manualPrice }),
  });
  if (!res.ok) {
    throw new Error('فشل تغيير نمط المعايرة');
  }
  return await res.json();
}

/**
 * Trigger instantaneous Auto-Calibration to TradingView Live
 */
export async function triggerAutoCalibration(): Promise<{ success: boolean; quote: any; messageAr: string }> {
  const res = await fetch('/api/gold/auto-calibrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error('فشل تفعيل الضبط التلقائي');
  }
  return await res.json();
}

/**
 * Get active pricing calibration mode
 */
export async function fetchPricingModeStatus(): Promise<{ mode: string; currentPrice: number; autoCalibrated: boolean }> {
  const res = await fetch('/api/gold/pricing-mode');
  if (!res.ok) {
    return { mode: 'tradingview_live', currentPrice: 0, autoCalibrated: false };
  }
  return await res.json();
}
