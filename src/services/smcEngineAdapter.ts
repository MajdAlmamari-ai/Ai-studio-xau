/**
 * Adapter: RealSMCAnalysis -> SMCAnalysis
 *
 * Bridges the new pure engine (src/engine/) with the
 * existing UI contracts (src/types.ts).
 *
 * Deterministic. No Math.random.
 */

import type {
  SMCAnalysis,
  SMCConfig,
  MarketBias,
  TradeAction,
  MarketStructure,
  FairValueGap,
  OrderBlockDetail,
} from '../types';
import type {
  RealSMCAnalysis,
  FVGZone,
  OrderBlock,
  StructureBreak,
} from '../engine/types';

// ============================================================
// Helpers
// ============================================================

function deriveBias(real: RealSMCAnalysis): MarketBias {
  const r = real.regime.regime;
  if (r === 'TREND_UP') return 'BULLISH';
  if (r === 'TREND_DOWN') return 'BEARISH';

  // Fall back to latest break direction
  if (real.breaks.length > 0) {
    const last = real.breaks[real.breaks.length - 1];
    if (last.type === 'BOS_UP' || last.type === 'CHOCH_UP') return 'BULLISH';
    if (last.type === 'BOS_DOWN' || last.type === 'CHOCH_DOWN') return 'BEARISH';
  }
  return 'NEUTRAL';
}

function deriveAction(bias: MarketBias): TradeAction {
  if (bias === 'BULLISH') return 'BUY';
  if (bias === 'BEARISH') return 'SELL';
  return 'WAIT';
}

function deriveStructure(real: RealSMCAnalysis): MarketStructure {
  const r = real.regime.regime;
  if (r === 'TREND_UP') return 'Uptrend (Bullish)';
  if (r === 'TREND_DOWN') return 'Downtrend (Bearish)';
  return 'Consolidation (Range-bound)';
}

function latestBreak(
  breaks: ReadonlyArray<StructureBreak>,
): StructureBreak | null {
  if (breaks.length === 0) return null;
  return breaks[breaks.length - 1];
}

// ============================================================
// FVG conversion
// ============================================================

function convertFVG(z: FVGZone): FairValueGap {
  const ce = (z.top + z.bottom) / 2;
  let status: FairValueGap['status'];
  if (z.status === 'ACTIVE') status = 'Fresh';
  else if (z.status === 'PARTIAL') status = 'Partially Filled';
  else status = 'Mitigated';

  const fillPercentage =
    z.status === 'ACTIVE' ? 0 :
    z.status === 'PARTIAL' ? 50 :
    z.status === 'FULL_FILLED' ? 100 :
    100; // INVALIDATED

  return {
    id: z.id,
    type: z.direction === 'BULLISH' ? 'BISI' : 'SIBI',
    top: z.top,
    bottom: z.bottom,
    ce,
    timeframe: '15M',
    status,
    fillPercentage,
    isMarketMemory: false,
  };
}

// ============================================================
// OrderBlock conversion
// ============================================================

function convertOB(ob: OrderBlock): OrderBlockDetail {
  const equilibrium = (ob.top + ob.bottom) / 2;
  let mitigationStatus: OrderBlockDetail['mitigationStatus'];
  if (ob.status === 'ACTIVE') mitigationStatus = 'Unmitigated';
  else if (ob.status === 'MITIGATED') mitigationStatus = 'Tested';
  else mitigationStatus = 'Breached';

  return {
    id: ob.id,
    type: ob.direction === 'BULLISH' ? 'BULLISH_DEMAND' : 'BEARISH_SUPPLY',
    min: ob.bottom,
    max: ob.top,
    equilibrium,
    timeframe: '15M',
    volume: 'derived_from_ohlc',
    mitigationStatus,
    confluenceScore: Math.round(realSafe(ob.displacementAtr)),
    barsAge: 0,
    freshnessScore: ob.status === 'ACTIVE' ? 100 : ob.status === 'MITIGATED' ? 50 : 0,
    isMarketMemory: false,
  };
}

function realSafe(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v * 20));
}

// ============================================================
// Main adapter
// ============================================================

export function convertRealAnalysisToSMC(
  real: RealSMCAnalysis,
  config: SMCConfig,
): SMCAnalysis {
  const bias = deriveBias(real);
  const action = deriveAction(bias);
  const structure = deriveStructure(real);

  const atr = real.atrCurrent ?? 1;

  // Key levels
  const currentPrice = real.currentPrice;
  const bsl = Number((currentPrice + config.bslOffset).toFixed(2));
  const ssl = Number((currentPrice - config.sslOffset).toFixed(2));
  const resistance = Number((currentPrice + config.resistanceOffset).toFixed(2));
  const support = Number((currentPrice - config.supportOffset).toFixed(2));

  // FVGs
  const fvgs: FairValueGap[] = real.fvgs.map(convertFVG);

  // Order blocks
  const orderBlocks: OrderBlockDetail[] = real.orderBlocks.map(convertOB);

  // Bullish / Bearish OB summary (first matching)
  const bullishOBRaw = real.orderBlocks.find((o) => o.direction === 'BULLISH');
  const bearishOBRaw = real.orderBlocks.find((o) => o.direction === 'BEARISH');

  const bullishOB = bullishOBRaw
    ? {
        min: bullishOBRaw.bottom,
        max: bullishOBRaw.top,
        barsAge: 0,
        freshnessScore: bullishOBRaw.status === 'ACTIVE' ? 100 : 50,
        mitigationStatus: bullishOBRaw.status === 'ACTIVE' ? 'Unmitigated' as const
          : bullishOBRaw.status === 'MITIGATED' ? 'Tested' as const
          : 'Breached' as const,
      }
    : { min: support - 1.5, max: support + 0.5 };

  const bearishOB = bearishOBRaw
    ? {
        min: bearishOBRaw.bottom,
        max: bearishOBRaw.top,
        barsAge: 0,
        freshnessScore: bearishOBRaw.status === 'ACTIVE' ? 100 : 50,
        mitigationStatus: bearishOBRaw.status === 'ACTIVE' ? 'Unmitigated' as const
          : bearishOBRaw.status === 'MITIGATED' ? 'Tested' as const
          : 'Breached' as const,
      }
    : { min: resistance - 0.5, max: resistance + 1.5 };

  // Entry/SL/TP (derived from ATR and bias)
  let entryZone = { min: currentPrice, max: currentPrice };
  let stopLoss = currentPrice;
  let takeProfit = currentPrice;
  let rrNumeric = 0;
  let riskRewardRatio = 'N/A';

  if (action === 'BUY') {
    entryZone = {
      min: Number((currentPrice - 0.5 * atr).toFixed(2)),
      max: Number((currentPrice + 0.2 * atr).toFixed(2)),
    };
    stopLoss = Number((support - 1.0 * atr).toFixed(2));
    takeProfit = Number((currentPrice + 2.5 * atr).toFixed(2));
    const risk = entryZone.max - stopLoss;
    const reward = takeProfit - entryZone.max;
    rrNumeric = risk > 0 ? Number((reward / risk).toFixed(2)) : 0;
    riskRewardRatio = `1:${rrNumeric}`;
  } else if (action === 'SELL') {
    entryZone = {
      min: Number((currentPrice - 0.2 * atr).toFixed(2)),
      max: Number((currentPrice + 0.5 * atr).toFixed(2)),
    };
    stopLoss = Number((resistance + 1.0 * atr).toFixed(2));
    takeProfit = Number((currentPrice - 2.5 * atr).toFixed(2));
    const risk = stopLoss - entryZone.min;
    const reward = entryZone.min - takeProfit;
    rrNumeric = risk > 0 ? Number((reward / risk).toFixed(2)) : 0;
    riskRewardRatio = `1:${rrNumeric}`;
  }

  // Confluence score
  const confluenceScore = real.confluence.score;

  // Reason
  const reason = buildReason(real, bias, confluenceScore);

  // realEngine field
  const realEngine = {
    asOfIndex: real.asOfIndex,
    asOfTime: real.asOfTime,
    atrCurrent: real.atrCurrent,
    regime: real.regime.regime,
    confluenceScore: real.confluence.score,
    confluenceEligible: real.confluence.eligible,
    reasonCodes: [...real.reasonCodes],
    swingCount: real.swings.length,
    breakCount: real.breaks.length,
    fvgCount: real.fvgs.length,
    obCount: real.orderBlocks.length,
    levelCount: real.levels.length,
    sweepCount: real.sweeps.length,
  };

  return {
    currentPrice,
    bias,
    action,
    structure,
    bsl,
    ssl,
    resistance,
    support,
    bullishOB,
    bearishOB,
    fvgs,
    orderBlocks,
    entryZone,
    takeProfit,
    stopLoss,
    riskRewardRatio,
    rrNumeric,
    reason,
    timestamp: new Date(real.asOfTime * 1000).toISOString(),
    confluenceScore,
    realEngine,
  };
}

function buildReason(
  real: RealSMCAnalysis,
  bias: MarketBias,
  score: number,
): string {
  const latest = latestBreak(real.breaks);
  const breakStr = latest ? `آخر كسر: ${latest.type} عند ${latest.level.toFixed(2)}` : 'لا يوجد كسر حديث';
  const regimeStr = `النظام: ${real.regime.regime}`;
  const confStr = `درجة التقارب: ${score}/100`;
  return `${regimeStr} • ${breakStr} • ${confStr} • اتجاه: ${bias}`;
}
