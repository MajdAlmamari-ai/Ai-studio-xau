import { GoldPriceData } from '../types';

export interface GoldFetchResult {
  data: GoldPriceData;
  isSuccess: boolean;
  source: 'gateio_server' | 'gateio_direct' | 'tencent_server' | 'eastmoney_backup' | 'cache_fallback';
  error?: string;
  latencyMs: number;
}

/**
 * Gate.io Official XAU/USD Spot API Market Data Service
 * ----------------------------------------------------------------
 * 1. Primary Source: Gate.io Spot API via Server Proxy (/api/gateio/spot/master, /api/gold/spot)
 * 2. Secondary Source: Direct Gate.io API v4 Browser Fetch (https://api.gateio.ws/api/v4/spot/tickers?currency_pair=PAXG_USDT)
 * 3. Resilient Fallback: Preserves last known spot price during network degradation
 */
export async function fetchGoldPriceWithStatus(
  lastKnownPrice?: number | null,
  signal?: AbortSignal
): Promise<GoldFetchResult> {
  const startTime = Date.now();

  // 1. Primary: Try local server Gate.io Spot master / price endpoint
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
          source: 'gateio_server',
          latencyMs: latency,
          data: {
            price: Number(p.toFixed(2)),
            currency: quote.currency || 'USD',
            symbol: quote.symbol || 'XAU/USD (Gate CFD)',
            name: quote.name || 'Gate.io CFD API v4 (XAUUSD)',
            updatedAt: quote.updatedAt || new Date().toISOString(),
            source: quote.source || 'gateio_cfd',
            isOffline: quote.isOffline ?? false,
            statusMessageAr: quote.statusMessageAr || 'الضبط التلقائي نشط ومطابق لشارت Gate CFD (XAUUSD) الحي',
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
            pricingMode: quote.pricingMode ?? 'gateio_cfd',
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
    // Server proxy failed or timed out, proceed to direct Gate.io fetch
  }

  // 2. Secondary: Direct Browser HTTP Fetch from Gate.io API v4 Spot Tickers (CORS enabled)
  try {
    const directController = new AbortController();
    const directTimeout = setTimeout(() => directController.abort(), 2500);

    const onAbortDirect = () => directController.abort();
    if (signal) {
      signal.addEventListener('abort', onAbortDirect, { once: true });
    }

    const res = await fetch('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=PAXG_USDT', {
      signal: directController.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(directTimeout);
    if (signal) {
      signal.removeEventListener('abort', onAbortDirect);
    }

    if (res.ok) {
      const data = await res.json();
      const t = Array.isArray(data) ? data[0] : data;
      const price = parseFloat(t?.last);

      if (!isNaN(price) && price > 0) {
        const bid = parseFloat(t.highest_bid) || price;
        const ask = parseFloat(t.lowest_ask) || price;
        const high = parseFloat(t.high_24h) || price;
        const low = parseFloat(t.low_24h) || price;
        const change24h = parseFloat(t.change_percentage) || 0;
        const spreadVal = Number(Math.max(0, ask - bid).toFixed(2));
        const latency = Date.now() - startTime;

        return {
          isSuccess: true,
          source: 'gateio_direct',
          latencyMs: latency,
          data: {
            price: Number(price.toFixed(2)),
            currency: 'USD',
            symbol: 'XAU/USD Spot',
            name: 'Gate.io Spot API v4 Direct (PAXG/USDT)',
            updatedAt: new Date().toISOString(),
            source: 'gateio_spot',
            isOffline: false,
            statusMessageAr: 'تغذية مباشرة وحصرية من منصة Gate.io API v4 (XAU/USD Spot)',
            change24h,
            high24h: Number(high.toFixed(2)),
            low24h: Number(low.toFixed(2)),
            bid: Number(bid.toFixed(2)),
            ask: Number(ask.toFixed(2)),
            spreadPoints: Math.round(spreadVal * 100),
            spreadPips: Number((spreadVal * 10).toFixed(1)),
            spreadOffset: 0,
            spreadOffsetFormatted: '0.00$',
            referencePrice: price,
            mt5Bid: bid,
            mt5Ask: ask,
            mt5SpreadPoints: Math.round(spreadVal * 100),
            mt5SpreadPips: Number((spreadVal * 10).toFixed(1)),
          },
        };
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError' && signal?.aborted) {
      throw e;
    }
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
      pricingMode: 'gateio_spot',
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
 * Switch pricing calibration mode (Gate CFD vs Gate Spot vs Manual)
 */
export async function setAutoCalibratePricingMode(
  mode: 'gateio_cfd' | 'gateio_spot' | 'manual',
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
 * Trigger instantaneous Auto-Calibration to Gate CFD (XAUUSD)
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
    return { mode: 'gateio_cfd', currentPrice: 0, autoCalibrated: false };
  }
  return await res.json();
}
