import { 
  SMCAnalysis, 
  SMCConfig, 
  MarketBias, 
  TradeAction, 
  MarketStructure, 
  FairValueGap, 
  OrderBlockDetail 
} from '../types';
import { runRealSMCEngine } from '../engine/engine';
import { convertRealAnalysisToSMC } from './smcEngineAdapter';
import { fetchTvHistory } from './tvHistoryClient';
import { candleToNormalized, NormalizedCandle } from '../types/sharedTypes';
import type { Regime, ConfluenceResult } from '../engine/types';
import { PriceSourceEnforcer, DataUnavailableError } from '../engine/enforcer/PriceSourceEnforcer';
import type { FuturesCandle } from '../engine/types/branded';

export function mapRegimeToBias(regime: Regime): MarketBias {
  switch (regime) {
    case 'TREND_UP': return 'BULLISH';
    case 'TREND_DOWN': return 'BEARISH';
    default: return 'NEUTRAL';
  }
}

export function mapBiasToAction(
  bias: MarketBias,
  confluence: ConfluenceResult,
): TradeAction {
  if (!confluence.eligible) return 'WAIT';
  if (bias === 'BULLISH') return 'BUY';
  if (bias === 'BEARISH') return 'SELL';
  return 'WAIT';
}

export function mapRegimeToStructure(regime: Regime): MarketStructure {
  switch (regime) {
    case 'TREND_UP': return 'Uptrend (Bullish)';
    case 'TREND_DOWN': return 'Downtrend (Bearish)';
    default: return 'Consolidation (Range-bound)';
  }
}

/**
 * ------------------------------------------------------------------------------------
 * خوارزمية درجة التآكل والنضارة المؤسساتية (Institutional Zone Freshness Algorithm)
 * ------------------------------------------------------------------------------------
 * المعادلة الرياضية والمنطق الكمي:
 * 1. عند تشكل كتلة الأوامر (Order Block)، تتكدس أوامر صناع السوق (Resting Limit Orders).
 * 2. مع مرور الشموع (barsAge):
 *    - من 0 إلى 5 شموع: نضارة فائقة 100% (أوامر البنوك بكامل كثافتها ولم تُلمس).
 *    - من 6 إلى 19 شمعة: تآكل تدريجي خطي للسيولة:
 *      Score = 100 - ((barsAge - 5) / (20 - 5)) * 100
 *    - 20 شمعة فأكثر: تآكل كامل 0% (استُهلكت الأوامر وأصبحت المنطقة هشة ومعرضة للكسر).
 * 3. خصم التخفيف والاختبار (Mitigation Penalty):
 *    - عند اختبار المنطقة (Tested): يخصم 15% إضافية لاستهلاك جزء من السيولة المعلقة.
 *    - عند اختراق المنطقة (Breached): يخصم 70% لكونها فقدت موثوقيتها الهيكلية.
 */
export interface ZoneFreshnessResult {
  score: number; // 0% to 100%
  barsAge: number;
  decayRatio: number; // 0.0 to 1.0
  tier: 'SUPER_FRESH' | 'MODERATE' | 'ERODED';
  tierLabelAr: string;
  verdictAr: string;
  reboundProbabilityPct: number;
}

export function calculateOBZoneFreshness(
  barsAge: number,
  mitigationStatus: 'Unmitigated' | 'Tested' | 'Breached' = 'Unmitigated'
): ZoneFreshnessResult {
  const age = Math.max(1, Math.round(barsAge));
  let baseScore = 100;

  if (age <= 5) {
    baseScore = 100;
  } else if (age >= 20) {
    baseScore = 0;
  } else {
    // التآكل الخطي من 5 إلى 20 شمعة
    baseScore = Math.round(100 - ((age - 5) / (20 - 5)) * 100);
  }

  // تطبيق خصم استهلاك الأوامر في حال اختبار المنطقة مسبقاً
  let penalty = 0;
  if (mitigationStatus === 'Tested') {
    penalty = 15;
  } else if (mitigationStatus === 'Breached') {
    penalty = 70;
  }

  const finalScore = Math.max(0, Math.min(100, baseScore - penalty));
  const decayRatio = Number(((100 - finalScore) / 100).toFixed(2));

  let tier: 'SUPER_FRESH' | 'MODERATE' | 'ERODED' = 'SUPER_FRESH';
  let tierLabelAr = 'نضارة فائقة (Fresh 🟢)';
  let verdictAr = 'أوامر مؤسساتية كاملة وغير ملموسة؛ ارتداد سريع وعالي الدقة.';
  let reboundProbabilityPct = 88;

  if (finalScore >= 70) {
    tier = 'SUPER_FRESH';
    tierLabelAr = 'نضارة فائقة (Fresh 🟢)';
    verdictAr = 'أوامر مؤسساتية كاملة وغير ملموسة؛ ارتداد سريع وعالي الدقة.';
    reboundProbabilityPct = Math.min(96, 76 + Math.round(finalScore * 0.2));
  } else if (finalScore >= 40) {
    tier = 'MODERATE';
    tierLabelAr = 'متوسطة النضارة (Tested 🟡)';
    verdictAr = 'تم استهلاك جزء من السيولة؛ يُنصح بانتظار شمعة انعكاسية على فريم أصغر.';
    reboundProbabilityPct = Math.min(74, 48 + Math.round(finalScore * 0.25));
  } else {
    tier = 'ERODED';
    tierLabelAr = 'منطقة متآكلة (Eroded 🔴)';
    verdictAr = 'استُهلكت الأوامر بعد مرور 20+ شمعة؛ احتمال مرتفع للكسر وتجاوز السيولة.';
    reboundProbabilityPct = Math.max(12, Math.round(finalScore * 0.55));
  }

  return {
    score: finalScore,
    barsAge: age,
    decayRatio,
    tier,
    tierLabelAr,
    verdictAr,
    reboundProbabilityPct,
  };
}

// Re-export standard helper for 0-100% calculation
export function calculateZoneFreshness(barsAge: number): number {
  return calculateOBZoneFreshness(barsAge, 'Unmitigated').score;
}

export const DEFAULT_SMC_CONFIG: SMCConfig = {
  bslOffset: 8,
  sslOffset: 6,
  resistanceOffset: 5,
  supportOffset: 4,
  tpOffsetBuy: 12,
  slOffsetBuy: 4,
  tpOffsetSell: 10,
  slOffsetSell: 4,
  auditMode: false,
};

// === Real Institutional SMC Engine (100% Real TradingView / CME GC1! Candles) ===
export async function calculateSMC(
  price: number | null,
  config: SMCConfig = DEFAULT_SMC_CONFIG,
): Promise<SMCAnalysis> {
  // 1. Fetch REAL institutional candles for COMEX GC1! from TradingView relay
  let tvResult;
  try {
    tvResult = await fetchTvHistory({
      key: 'futures',
      timeframe: '15m',
      barCount: 200,
    });
  } catch (err: any) {
    throw new DataUnavailableError('TV_FETCH_FAILED', `TradingView history fetch failed: ${err?.message || err}`);
  }

  if (!tvResult.ok || !tvResult.candles || tvResult.candles.length < 30) {
    throw new DataUnavailableError('TV_FUTURES_UNAVAILABLE', 'Insufficient COMEX:GC1! history from TradingView');
  }

  // Enforce FuturesCandle branded types via PriceSourceEnforcer
  const futuresCandles: FuturesCandle[] = tvResult.candles.map((c) =>
    PriceSourceEnforcer.enforceFutures({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume ?? 0,
      source: 'FUTURES',
    })
  );

  // 2. Run REAL engine on COMEX GC1! candles
  const real = runRealSMCEngine(futuresCandles);

  // 3. Convert to legacy SMCAnalysis
  return convertRealAnalysisToSMC(real, config);
}

/**
 * Fetch SMC Quantitative Analysis directly from the full-stack server backend (/api/smc/analysis).
 * Seamlessly falls back to client-side calculateSMC if offline or server is unavailable.
 */
export async function fetchSMCAnalysisFromServer(
  price: number,
  config: SMCConfig = DEFAULT_SMC_CONFIG
): Promise<SMCAnalysis> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch('/api/smc/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price, config }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const serverAnalysis = await response.json();
      if (serverAnalysis && serverAnalysis.currentPrice) {
        return serverAnalysis as SMCAnalysis;
      }
    }
  } catch (err) {
    // Graceful fallback to client engine
  }
  return calculateSMC(price, config);
}


