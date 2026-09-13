/**
 * Gold-API.com Client
 * 
 * Primary source for Spot XAUUSD price.
 * 
 * Endpoint: https://www.goldapi.io/api/XAU/USD
 * Auth: x-access-token header
 * 
 * NO FAKE DATA:
 *   - On failure, returns { ok: false, reason }
 *   - Never returns a default value.
 *   - Caller must handle the failure.
 */

export interface GoldApiResponse {
  timestamp: number;
  metal: string;
  currency: string;
  exchange: string;
  symbol: string;
  prev_close_price: number;
  open_price: number;
  low_price: number;
  high_price: number;
  open_time: number;
  price: number;
  ch: number;
  chp: number;
  ask: number;
  bid: number;
}

export interface GoldApiSuccess {
  ok: true;
  data: GoldApiResponse;
  source: 'gold-api';
  fetchedAt: number;
  latencyMs: number;
}

export interface GoldApiFailure {
  ok: false;
  reason: {
    code: string;
    shortAr: string;
    detailsAr: string;
    howToFix: string[];
  };
  fetchedAt: number;
}

export type GoldApiResult = GoldApiSuccess | GoldApiFailure;

const GOLD_API_URL = 'https://www.goldapi.io/api/XAU/USD';
const TIMEOUT_MS = 5000;

export async function fetchGoldApiSpot(): Promise<GoldApiResult> {
  const apiKey = (import.meta as any).env?.VITE_GOLD_API_KEY
    || (import.meta as any).env?.GOLD_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      reason: {
        code: 'GOLD_API_KEY_MISSING',
        shortAr: 'مفتاح Gold-API غير متوفر',
        detailsAr: 'VITE_GOLD_API_KEY غير موجود في .env.local',
        howToFix: [
          'أضف GOLD_API_KEY إلى .env.local',
          'أعد تشغيل الخادم'
        ]
      },
      fetchedAt: Date.now(),
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const response = await fetch(GOLD_API_URL, {
      method: 'GET',
      headers: {
        'x-access-token': apiKey,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return {
        ok: false,
        reason: {
          code: `GOLD_API_HTTP_${response.status}`,
          shortAr: `Gold-API أعاد ${response.status}`,
          detailsAr: `HTTP ${response.status}: ${response.statusText}`,
          howToFix: [
            'تحقق من صلاحية المفتاح',
            'راجع https://www.goldapi.io/dashboard',
            'أعد المحاولة بعد دقيقة'
          ]
        },
        fetchedAt: Date.now(),
      };
    }

    const data = (await response.json()) as GoldApiResponse;

    if (!data || typeof data.price !== 'number' || data.price <= 0) {
      return {
        ok: false,
        reason: {
          code: 'GOLD_API_INVALID_RESPONSE',
          shortAr: 'Gold-API أعاد بيانات غير صالحة',
          detailsAr: `Response: ${JSON.stringify(data).slice(0, 200)}`,
          howToFix: [
            'أعد المحاولة',
            'إذا استمر: استخدم fallback'
          ]
        },
        fetchedAt: Date.now(),
      };
    }

    return {
      ok: true,
      data,
      source: 'gold-api',
      fetchedAt: Date.now(),
      latencyMs,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err?.name === 'AbortError';
    return {
      ok: false,
      reason: {
        code: isAbort ? 'GOLD_API_TIMEOUT' : 'GOLD_API_NETWORK_ERROR',
        shortAr: isAbort ? 'انتهت مهلة Gold-API' : 'فشل الاتصال بـ Gold-API',
        detailsAr: `${err?.message || 'Unknown error'}`,
        howToFix: [
          'تحقق من الاتصال بالإنترنت',
          'أعد المحاولة'
        ]
      },
      fetchedAt: Date.now(),
    };
  }
}
