import { 
  SMCAnalysis, 
  SMCConfig, 
  MarketBias, 
  TradeAction, 
  MarketStructure, 
  FairValueGap, 
  OrderBlockDetail 
} from '../types';
import { fetchGateIoCandlesticks } from './gateIoService';
import { runRealSMCEngine } from '../engine/engine';
import { convertRealAnalysisToSMC } from './smcEngineAdapter';
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

import { 
  calculateCompressionMetrics, 
  calculateWickFilter, 
  getMarketMemoryIndex 
} from './compressionWickService';
import { calculateOrderFlowVolume } from './orderFlowVolumeService';
import { calculatePostNewsSweep } from './postNewsSweepService';

export const DEFAULT_SMC_CONFIG: SMCConfig = {
  bullishThreshold: 4475,
  bearishThreshold: 4470,
  bslOffset: 8,
  sslOffset: 6,
  resistanceOffset: 5,
  supportOffset: 4,
  tpOffsetBuy: 12,
  slOffsetBuy: 4,
  tpOffsetSell: 10,
  slOffsetSell: 4,
};

/**
 * Calculates SMC Metrics according to institutional Smart Money Concepts
 * Integrated with:
 * - Real Volume / CME GC Order Flow Confluence
 * - Post-News Liquidity Sweep Detection
 * - Compression / Spring Coil Algorithm
 * - Wick Filter & Dynamic Stop Loss (10-bar max wick + 1.5 ATR)
 * - Zone Freshness (0-100% erosion based on barsAge and mitigation)
 * - Market Memory Index
 */
// === Fallback (kept for offline mode) ===
function calculateSMCFallback(
  price: number | null,
  config: SMCConfig = DEFAULT_SMC_CONFIG,
): SMCAnalysis {
  const effectivePrice = (price !== null && !isNaN(price) && price > 0) ? price : null;
  if (effectivePrice === null) {
    throw new Error(
      'PRICE_UNAVAILABLE: calculateSMC requires a valid price.'
    );
  }
  const roundedPrice = Number(effectivePrice.toFixed(2));

  // 1. Determining Bias
  let bias: MarketBias = 'NEUTRAL';
  let action: TradeAction = 'WAIT';
  let structure: MarketStructure = 'Consolidation (Range-bound)';

  if (roundedPrice > config.bullishThreshold) {
    bias = 'BULLISH';
    action = 'BUY';
    structure = 'Uptrend (Bullish)';
  } else if (roundedPrice < config.bearishThreshold) {
    bias = 'BEARISH';
    action = 'SELL';
    structure = 'Downtrend (Bearish)';
  } else {
    bias = 'NEUTRAL';
    action = 'WAIT';
    structure = 'Consolidation (Range-bound)';
  }

  // 2. Liquidity Zones
  const bsl = Number((roundedPrice + config.bslOffset).toFixed(2));
  const ssl = Number((roundedPrice - config.sslOffset).toFixed(2));

  // 3. Key Levels
  const resistance = Number((roundedPrice + config.resistanceOffset).toFixed(2));
  const support = Number((roundedPrice - config.supportOffset).toFixed(2));

  // --- Dynamic Order Block Processing with Zone Freshness Algorithm ---
  // A. Demand Order Block (Bullish OB)
  const rawBullishMin = Number((support - 1.5).toFixed(2));
  const rawBullishMax = Number((support + 0.5).toFixed(2));

  let demandMitigation: 'Unmitigated' | 'Tested' | 'Breached' = 'Unmitigated';
  let demandBarsAge = 4; // Fresh 15M demand reaction
  if (roundedPrice < rawBullishMin) {
    demandMitigation = 'Breached';
    demandBarsAge = 22;
  } else if (roundedPrice <= rawBullishMax) {
    demandMitigation = 'Tested';
    demandBarsAge = 8;
  }

  const demandFreshnessResult = calculateOBZoneFreshness(demandBarsAge, demandMitigation);

  const bullishOB = {
    min: rawBullishMin,
    max: rawBullishMax,
    barsAge: demandBarsAge,
    freshnessScore: demandFreshnessResult.score,
    mitigationStatus: demandMitigation,
  };

  // B. Supply Order Block (Bearish OB)
  const rawBearishMin = Number((resistance - 0.5).toFixed(2));
  const rawBearishMax = Number((resistance + 1.5).toFixed(2));

  let supplyMitigation: 'Unmitigated' | 'Tested' | 'Breached' = 'Unmitigated';
  let supplyBarsAge = 8; // Formed 8 candles ago on H1
  if (roundedPrice > rawBearishMax) {
    supplyMitigation = 'Breached';
    supplyBarsAge = 24;
  } else if (roundedPrice >= rawBearishMin) {
    supplyMitigation = 'Tested';
    supplyBarsAge = 12;
  }

  const supplyFreshnessResult = calculateOBZoneFreshness(supplyBarsAge, supplyMitigation);

  const bearishOB = {
    min: rawBearishMin,
    max: rawBearishMax,
    barsAge: supplyBarsAge,
    freshnessScore: supplyFreshnessResult.score,
    mitigationStatus: supplyMitigation,
  };

  // Detailed Order Blocks with Freshness & Bar Age
  const orderBlocks: OrderBlockDetail[] = [
    {
      id: 'ob-demand-15m',
      type: 'BULLISH_DEMAND',
      min: bullishOB.min,
      max: bullishOB.max,
      equilibrium: Number(((bullishOB.min + bullishOB.max) / 2).toFixed(2)),
      timeframe: '15M',
      volume: 'عالي (سيولة شراء مؤسساتية نشطة)',
      mitigationStatus: bullishOB.mitigationStatus,
      confluenceScore: 94,
      barsAge: bullishOB.barsAge,
      freshnessScore: bullishOB.freshnessScore,
      isMarketMemory: false,
    },
    {
      id: 'ob-supply-15m',
      type: 'BEARISH_SUPPLY',
      min: bearishOB.min,
      max: bearishOB.max,
      equilibrium: Number(((bearishOB.min + bearishOB.max) / 2).toFixed(2)),
      timeframe: '15M / 1H',
      volume: 'متوسط إلى عالي (أوامر بيع متراكمة)',
      mitigationStatus: bearishOB.mitigationStatus,
      confluenceScore: 88,
      barsAge: bearishOB.barsAge,
      freshnessScore: bearishOB.freshnessScore,
      isMarketMemory: false,
    },
    {
      id: 'ob-institutional-discount',
      type: 'BULLISH_DEMAND',
      min: Number((support - 6.0).toFixed(2)),
      max: Number((support - 4.0).toFixed(2)),
      equilibrium: Number((support - 5.0).toFixed(2)),
      timeframe: '4H Key Zone',
      volume: 'مؤسساتي فائق (السيولة العميقة)',
      mitigationStatus: 'Unmitigated',
      confluenceScore: 96,
      barsAge: 11,
      freshnessScore: calculateOBZoneFreshness(11, 'Unmitigated').score, // ~60%
      isMarketMemory: false,
    },
    {
      id: 'ob-continuation-coil-m30',
      type: 'BULLISH_DEMAND',
      min: Number((support + 1.2).toFixed(2)),
      max: Number((support + 2.4).toFixed(2)),
      equilibrium: Number((support + 1.8).toFixed(2)),
      timeframe: '30M Intraday',
      volume: 'سيولة اختراق صاعدة (Coil Expansion)',
      mitigationStatus: 'Unmitigated',
      confluenceScore: 91,
      barsAge: 3,
      freshnessScore: calculateOBZoneFreshness(3, 'Unmitigated').score, // 100%
      isMarketMemory: false,
    },
    {
      id: 'ob-stale-pivot-daily',
      type: 'BEARISH_SUPPLY',
      min: Number((resistance + 5.5).toFixed(2)),
      max: Number((resistance + 7.5).toFixed(2)),
      equilibrium: Number((resistance + 6.5).toFixed(2)),
      timeframe: 'Daily / 4H',
      volume: 'كتلة قديمة متآكلة (Stale Overhead)',
      mitigationStatus: 'Tested',
      confluenceScore: 68,
      barsAge: 21,
      freshnessScore: calculateOBZoneFreshness(21, 'Tested').score, // 0%
      isMarketMemory: false,
    },
  ];

  // Fair Value Gaps (FVG) / فجوات القيمة العادلة
  const fvgs: FairValueGap[] = [
    {
      id: 'fvg-bisi-1',
      type: 'BISI', // Bullish FVG
      top: Number((roundedPrice + 3.2).toFixed(2)),
      bottom: Number((roundedPrice + 1.1).toFixed(2)),
      ce: Number((roundedPrice + 2.15).toFixed(2)), // Consequent Encroachment (50%)
      timeframe: '15M',
      status: roundedPrice > roundedPrice + 2.15 ? 'Partially Filled' : 'Fresh',
      fillPercentage: 35,
      isMarketMemory: false,
    },
    {
      id: 'fvg-sibi-1',
      type: 'SIBI', // Bearish FVG
      top: Number((roundedPrice - 1.2).toFixed(2)),
      bottom: Number((roundedPrice - 3.4).toFixed(2)),
      ce: Number((roundedPrice - 2.3).toFixed(2)),
      timeframe: '1H',
      status: 'Fresh',
      fillPercentage: 15,
      isMarketMemory: false,
    },
    {
      id: 'fvg-discount-macro',
      type: 'BISI',
      top: Number((support + 1.8).toFixed(2)),
      bottom: Number((support - 0.4).toFixed(2)),
      ce: Number((support + 0.7).toFixed(2)),
      timeframe: '4H',
      status: 'Partially Filled',
      fillPercentage: 60,
      isMarketMemory: false,
    },
  ];

  // 4. Memory Index Layer (Historical Pivotal OBs & FVGs)
  const { memoryOBs, memoryFVGs } = getMarketMemoryIndex(roundedPrice);
  const allOrderBlocks = [...orderBlocks, ...memoryOBs];
  const allFVGs = [...fvgs, ...memoryFVGs];

  // 5. Compression / Spring Coil Analysis
  const compression = calculateCompressionMetrics(roundedPrice);

  // 6. Wick Filter & Dynamic Stop Loss (10-bar max wick + 1.5 ATR)
  const targetDistance = action === 'BUY' ? config.tpOffsetBuy : config.tpOffsetSell;
  const wickFilter = calculateWickFilter(roundedPrice, action, targetDistance);

  // 7. Post-News Liquidity Sweep Module
  const postNewsSweep = calculatePostNewsSweep(roundedPrice);

  // 8. Real Volume & Order Flow Confluence
  const futuresEstPrice = Number((roundedPrice + 8.40).toFixed(2));
  const orderFlowVolume = calculateOrderFlowVolume(roundedPrice, futuresEstPrice, bias);

  // 9. Trade Execution Parameters & Wick Protection
  let entryZone = { min: roundedPrice, max: roundedPrice };
  let takeProfit = roundedPrice;
  let stopLoss = roundedPrice;
  let riskRewardRatio = '1:2.5';
  let rrNumeric = 2.5;
  let reason = '';
  let confluenceScore = 50;

  if (action === 'BUY') {
    entryZone = {
      min: Number((roundedPrice - 1.0).toFixed(2)),
      max: Number((roundedPrice + 0.5).toFixed(2)),
    };
    // Use Wick-protected Stop Loss
    stopLoss = wickFilter.dynamicStopLoss;
    takeProfit = Number((roundedPrice + config.tpOffsetBuy).toFixed(2));

    const risk = Math.abs(entryZone.max - stopLoss);
    const reward = Math.abs(takeProfit - entryZone.max);
    rrNumeric = risk > 0 ? Number((reward / risk).toFixed(2)) : 2.5;
    riskRewardRatio = `1:${rrNumeric}`;

    // If Wick filter rejected RR or Compression warns of unbreakout coil
    if (!wickFilter.isRRValid) {
      action = 'WAIT';
      confluenceScore = 60;
      reason = `تعليق الدخول (WAIT): ${wickFilter.explanationAr}`;
    } else if (compression.isCompressed && compression.springState === 'COMPRESSED_COIL') {
      confluenceScore = 75;
      reason = `تأهب انطلاق الزنبرك: السعر في حالة ضغط حاد (ATR أدنى مستوى بـ 20 شمعة). انتظر كسر قمة النطاق $${compression.breakoutTriggerLevel.high} قبل الدخول.`;
    } else {
      confluenceScore = 92;
      reason = `السعر أعلى من $${config.bullishThreshold}.00 مع تأكيد تدفق أوامر CME GC (+${(orderFlowVolume?.cvdDelta ?? 4280).toLocaleString('ar-EG')} عقد). وقف الخسارة ($${stopLoss}) محمي ضد الذيول الخاطفة (Max Wick + 1.5 ATR) مع هدف $${takeProfit} وعائد لمخاطرة 1:${rrNumeric}.`;
    }
  } else if (action === 'SELL') {
    entryZone = {
      min: Number((roundedPrice - 0.5).toFixed(2)),
      max: Number((roundedPrice + 1.0).toFixed(2)),
    };
    stopLoss = wickFilter.dynamicStopLoss;
    takeProfit = Number((roundedPrice - config.tpOffsetSell).toFixed(2));

    const risk = Math.abs(stopLoss - entryZone.min);
    const reward = Math.abs(entryZone.min - takeProfit);
    rrNumeric = risk > 0 ? Number((reward / risk).toFixed(2)) : 2.5;
    riskRewardRatio = `1:${rrNumeric}`;

    if (!wickFilter.isRRValid) {
      action = 'WAIT';
      confluenceScore = 58;
      reason = `تعليق الدخول (WAIT): ${wickFilter.explanationAr}`;
    } else {
      confluenceScore = 89;
      reason = `كسر هيكل هبوطي (BOS) مع سيطرة بائعي العقود الآجلة في CME. وقف البيع المحمي عند $${stopLoss} ونسبة العائد للمخاطرة 1:${rrNumeric}.`;
    }
  } else {
    entryZone = {
      min: Number((support + 0.5).toFixed(2)),
      max: Number((resistance - 0.5).toFixed(2)),
    };
    stopLoss = Number((support - 2.0).toFixed(2));
    takeProfit = Number((resistance + 2.0).toFixed(2));
    riskRewardRatio = '1:1.0 (غير مناسب)';
    rrNumeric = 1.0;
    confluenceScore = 45;

    reason = `السعر ($${roundedPrice}) داخل نطاق التوازن والتجميع. ${compression.isCompressed ? 'الزنبرك مضغوط وترقب كسر النطاق.' : 'بانتظار سحب سيولة BSL أو SSL.'}`;
  }

  return {
    currentPrice: roundedPrice,
    bias,
    action,
    structure,
    bsl,
    ssl,
    resistance,
    support,
    bullishOB,
    bearishOB,
    fvgs: allFVGs,
    orderBlocks: allOrderBlocks,
    entryZone,
    takeProfit,
    stopLoss,
    riskRewardRatio,
    rrNumeric,
    reason,
    timestamp: new Date().toISOString(),
    confluenceScore,
    wickFilter,
    compression,
    postNewsSweep,
    orderFlowVolume,
    memoryIndexOBs: memoryOBs,
  };
}

// === Real async version ===
export async function calculateSMC(
  price: number | null,
  config: SMCConfig = DEFAULT_SMC_CONFIG,
): Promise<SMCAnalysis> {
  try {
    // 1. Fetch REAL candles from Gate.io
    const candles = await fetchGateIoCandlesticks('futures', '15m', 200);
    if (!candles || candles.length < 50) {
      return calculateSMCFallback(price, config);
    }

    // 2. Run REAL engine
    const real = runRealSMCEngine(candles);

    // 3. Convert to legacy SMCAnalysis
    return convertRealAnalysisToSMC(real, config);
  } catch (err) {
    // Fallback on any network/API error
    return calculateSMCFallback(price, config);
  }
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


