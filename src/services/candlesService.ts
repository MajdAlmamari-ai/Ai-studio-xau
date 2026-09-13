import { ChartTimeframe, CandleResponseData } from '../types';

/**
 * Fetches real candle data for the specified timeframe (4H, 1D, 1W, 1M)
 * NEVER generates synthetic/fake candles.
 * Fails transparently if server API or upstream feeds are unavailable.
 */
export async function fetchCandlesData(
  timeframe: ChartTimeframe,
  currentPrice?: number | null,
  signal?: AbortSignal
): Promise<CandleResponseData> {
  const priceParam = (typeof currentPrice === 'number' && currentPrice > 0) ? `&currentPrice=${currentPrice}` : '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const onAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const res = await fetch(`/api/gold/candles?timeframe=${timeframe}${priceParam}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }

    if (res.ok) {
      const data: CandleResponseData = await res.json();
      if (data && Array.isArray(data.candles) && data.candles.length > 0) {
        return data;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
  }

  throw new Error(
    'NO_CANDLES_AVAILABLE: All candle sources failed. ' +
    'Options: retry, upload CSV, or wait 5 minutes.'
  );
}
