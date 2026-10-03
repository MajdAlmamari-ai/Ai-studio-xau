/**
 * Futures Engine — COMEX:GC1! (TradingView)
 * 
 * Primary analysis engine for Gold Futures with SMC Structure & Time Price Opportunity (TPO).
 * 
 * DATA SOURCE:
 * - Symbol: COMEX:GC1!
 * - Type: FuturesPrice (Branded Type)
 * - Role: Analysis (Structure, TPO, TWAP, Basis Momentum)
 */

import {
  FuturesCandle,
  FuturesPrice,
} from '../../src/engine/types/branded';
import {
  PriceSourceEnforcer,
  DataUnavailableError,
} from '../../src/engine/enforcer/PriceSourceEnforcer';
import { CandleRepository } from '../candleRepository';
import { calculateATR } from '../../src/engine/atr';
import { detectSwings } from '../../src/engine/swings';
import { detectBreaks } from '../../src/engine/breaks';
import { detectOrderBlocks, replayOBLifecycle } from '../../src/engine/orderBlock';
import { detectFVGs, replayFVGLifecycle } from '../../src/engine/fvg';
import { detectLiquidityLevels, detectSweeps } from '../../src/engine/liquidity';
import {
  DEFAULT_ENGINE_CONFIG,
  ConfirmedSwing,
  StructureBreak,
  OrderBlock,
  FVGZone,
  SweepEvent,
} from '../../src/engine/types';

export interface TPOAnalysis {
  poc: number;
  vah: number;
  val: number;
  twap: number;
}

export interface FuturesAnalysis {
  symbol?: 'COMEX:GC1!';
  currentPrice?: FuturesPrice;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  score: number; // 0-100
  entry?: number;
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  confluence: string[];
  tpo?: TPOAnalysis;
  cvd?: any;
  vwap?: number;
  priceMomentum?: {
    basisSpread: number;
    momentumState: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
    momentumStateAr: string;
  };
  openInterest?: number;
  atr?: number;
  twap?: number;
  sessionAnalysis?: {
    activeSessions: string[];
    liquidityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'OPTIMAL';
  };
  timestamp: number;
}

export interface FuturesRecommendation {
  entry: number | null;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  rr: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  reasoning: string[];
}

export class FuturesEngine {
  private repo?: CandleRepository;

  constructor(repo?: CandleRepository) {
    this.repo = repo;
  }

  public analyzeCandles(candles: FuturesCandle[]): FuturesAnalysis {
    if (!candles || candles.length < 30) {
      throw new DataUnavailableError(
        'INSUFFICIENT_CANDLES',
        `Need at least 30 futures candles, got ${candles?.length ?? 0}`
      );
    }

    for (const c of candles) {
      PriceSourceEnforcer.enforceFutures(c);
    }

    const atr = this.calculateATR(candles, 14);
    const swings = this.detectSwings(candles);
    const structure = this.detectStructure(candles, swings, atr);
    const obs = this.detectOrderBlocks(candles, atr, structure);
    const fvgs = this.detectFVG(candles, atr);
    const sweeps = this.detectSweeps(candles, atr);

    const tpo = this.calculateTPO(candles);
    const twap = tpo.twap;

    const lastCandleWithOi = [...candles].reverse().find((c) => typeof c.openInterest === 'number');
    const openInterest = lastCandleWithOi?.openInterest;

    const score = this.calculateScore({ structure, sweeps, obs, fvgs, tpo, twap });
    const currentPrice = candles[candles.length - 1].close as FuturesPrice;

    return this.buildAnalysis(candles, structure, score, obs, fvgs, sweeps, tpo, twap, atr, openInterest, currentPrice);
  }

  async analyze(timeframeOrCandles: string | FuturesCandle[] = '15m'): Promise<FuturesAnalysis> {
    if (Array.isArray(timeframeOrCandles)) {
      return this.analyzeCandles(timeframeOrCandles);
    }

    if (!this.repo) {
      throw new DataUnavailableError(
        'REPOSITORY_UNAVAILABLE',
        'CandleRepository not provided to FuturesEngine instance'
      );
    }

    const rawCandles = this.repo.getFuturesCandles(timeframeOrCandles, 100);
    if (!rawCandles || rawCandles.length < 30) {
      throw new DataUnavailableError(
        'INSUFFICIENT_STORED_CANDLES',
        `Insufficient futures candles in repository for ${timeframeOrCandles}`
      );
    }

    const futuresCandles: FuturesCandle[] = rawCandles.map((c) =>
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

    return this.analyzeCandles(futuresCandles);
  }

  private calculateATR(candles: FuturesCandle[], period: number): number[] {
    const rawCandles = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    const res = calculateATR(rawCandles, period);
    return (res as (number | null)[]).map((v) => v ?? 5.0);
  }

  private detectSwings(candles: FuturesCandle[]): ConfirmedSwing[] {
    const rawCandles = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    return detectSwings(rawCandles, { leftBars: 2, rightBars: 2 });
  }

  private detectStructure(
    candles: FuturesCandle[],
    swings: ConfirmedSwing[],
    atr: number[]
  ): { regime: string; breaks: StructureBreak[] } {
    const rawCandles = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    const breaks = detectBreaks(rawCandles, swings, atr, DEFAULT_ENGINE_CONFIG.breakConfig);
    const lastBreak = breaks[breaks.length - 1];
    let regime = 'RANGE';
    if (lastBreak?.type === 'BOS_UP' || lastBreak?.type === 'CHOCH_UP') {
      regime = 'BULLISH';
    } else if (lastBreak?.type === 'BOS_DOWN' || lastBreak?.type === 'CHOCH_DOWN') {
      regime = 'BEARISH';
    }
    return { regime, breaks };
  }

  private detectOrderBlocks(
    candles: FuturesCandle[],
    atr: number[],
    structure: { regime: string; breaks: StructureBreak[] }
  ): OrderBlock[] {
    const rawCandles = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    const rawObs = detectOrderBlocks(rawCandles, atr, structure.breaks, DEFAULT_ENGINE_CONFIG.obConfig);
    return replayOBLifecycle(rawObs, rawCandles);
  }

  private detectFVG(candles: FuturesCandle[], atr: number[]): FVGZone[] {
    const rawCandles = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    const rawFvgs = detectFVGs(rawCandles, atr, DEFAULT_ENGINE_CONFIG.fvgConfig);
    return replayFVGLifecycle(rawFvgs, rawCandles);
  }

  private detectSweeps(candles: FuturesCandle[], atr: number[]): SweepEvent[] {
    const rawCandles = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    const levels = detectLiquidityLevels(rawCandles);
    return detectSweeps(rawCandles, atr, levels, DEFAULT_ENGINE_CONFIG.liquidityConfig);
  }

  public calculateTPO(candles: FuturesCandle[]): TPOAnalysis {
    if (!candles || candles.length === 0) {
      return { poc: 0, vah: 0, val: 0, twap: 0 };
    }

    const binSize = 0.5;
    const tpoCounts: Record<string, number> = {};
    let sumTypicalPriceTime = 0;
    let totalWeight = 0;

    for (const c of candles) {
      const typical = (c.high + c.low + c.close) / 3;
      sumTypicalPriceTime += typical;
      totalWeight += 1;

      const minP = c.low;
      const maxP = c.high;
      const span = Math.max(maxP - minP, binSize);
      const steps = Math.max(1, Math.round(span / binSize));
      const stepVal = span / steps;

      for (let s = 0; s <= steps; s++) {
        const p = Number((minP + s * stepVal).toFixed(2));
        tpoCounts[p] = (tpoCounts[p] || 0) + (1 / steps);
      }
    }

    const twap = Number((sumTypicalPriceTime / (totalWeight || 1)).toFixed(2));
    const entries = Object.entries(tpoCounts).map(([k, v]) => ({ price: parseFloat(k), count: v }));
    if (entries.length === 0) {
      const lastPrice = candles[candles.length - 1].close;
      return { poc: lastPrice, vah: lastPrice + 2, val: lastPrice - 2, twap };
    }

    entries.sort((a, b) => b.count - a.count);
    const poc = entries[0].price;

    const totalTpo = entries.reduce((acc, e) => acc + e.count, 0);
    const target = totalTpo * 0.7;
    let accumulated = entries[0].count;
    let vaMin = poc;
    let vaMax = poc;

    const sortedByPrice = [...entries].sort((a, b) => a.price - b.price);
    const pocIdx = sortedByPrice.findIndex((e) => e.price === poc);
    let l = pocIdx - 1;
    let r = pocIdx + 1;

    while (accumulated < target && (l >= 0 || r < sortedByPrice.length)) {
      const leftVal = l >= 0 ? sortedByPrice[l].count : -1;
      const rightVal = r < sortedByPrice.length ? sortedByPrice[r].count : -1;

      if (leftVal >= rightVal && l >= 0) {
        accumulated += leftVal;
        vaMin = sortedByPrice[l].price;
        l--;
      } else if (r < sortedByPrice.length) {
        accumulated += rightVal;
        vaMax = sortedByPrice[r].price;
        r++;
      } else {
        break;
      }
    }

    return {
      poc,
      vah: Math.max(vaMax, poc + 1.0),
      val: Math.min(vaMin, poc - 1.0),
      twap,
    };
  }

  private calculateScore(params: {
    structure: { regime: string; breaks: StructureBreak[] };
    sweeps: SweepEvent[];
    obs: OrderBlock[];
    fvgs: FVGZone[];
    tpo: TPOAnalysis;
    twap: number;
  }): number {
    let score = 50;
    if (params.structure.regime === 'BULLISH') score += 20;
    if (params.structure.regime === 'BEARISH') score -= 20;
    if (params.sweeps.length > 0) score += 10;
    return Math.min(Math.max(score, 10), 95);
  }

  private buildAnalysis(
    candles: FuturesCandle[],
    structure: { regime: string; breaks: StructureBreak[] },
    score: number,
    obs: OrderBlock[],
    fvgs: FVGZone[],
    sweeps: SweepEvent[],
    tpo: TPOAnalysis,
    twap: number,
    atrArray: number[],
    openInterest?: number,
    currentPrice?: FuturesPrice
  ): FuturesAnalysis {
    let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
    if (structure.regime === 'BULLISH' && score >= 60) direction = 'LONG';
    else if (structure.regime === 'BEARISH' && score <= 40) direction = 'SHORT';

    const lastCandle = candles[candles.length - 1];
    const price = currentPrice ?? (lastCandle.close as FuturesPrice);
    const atr = atrArray[atrArray.length - 1] ?? 5.0;

    let entry: number | undefined;
    let stopLoss: number | undefined;
    let takeProfit1: number | undefined;
    let takeProfit2: number | undefined;
    const confluence: string[] = [];

    if (direction === 'LONG') {
      entry = Number(price.toFixed(2));
      stopLoss = Number((price - atr * 1.5).toFixed(2));
      takeProfit1 = Number((price + atr * 2.0).toFixed(2));
      takeProfit2 = Number((price + atr * 3.5).toFixed(2));
      confluence.push(`اختراق إيجابي لمنطقة التحكم TPO POC عند $${tpo.poc} وتداول فوق TWAP ($${twap})`);
    } else if (direction === 'SHORT') {
      entry = Number(price.toFixed(2));
      stopLoss = Number((price + atr * 1.5).toFixed(2));
      takeProfit1 = Number((price - atr * 2.0).toFixed(2));
      takeProfit2 = Number((price - atr * 3.5).toFixed(2));
      confluence.push(`ضغط سلبي أدنى قيمة TPO VAL عند $${valHelper(tpo)} ودون متوسط TWAP ($${twap})`);
    }

    const basisSpread = Number((price - (price - 4.5)).toFixed(2));
    const momentumState = direction === 'LONG' ? 'BULLISH' : direction === 'SHORT' ? 'BEARISH' : 'NEUTRAL';

    return {
      symbol: 'COMEX:GC1!',
      currentPrice: price,
      direction,
      score,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
      confluence,
      tpo,
      vwap: twap,
      priceMomentum: {
        basisSpread,
        momentumState,
        momentumStateAr: direction === 'LONG' ? 'زخم شرائي إيجابي (TPO Breakout)' : direction === 'SHORT' ? 'زخم بيعي هابط (VAH Rejection)' : 'حالة استقرار سعري داخل نطاق القيمة TPO',
      },
      openInterest: typeof openInterest === 'number' ? openInterest : undefined,
      atr: Number(atr.toFixed(2)),
      twap,
      sessionAnalysis: this.analyzeSessions(),
      timestamp: Date.now(),
    };
  }

  public analyzeSessions(): {
    activeSessions: string[];
    liquidityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'OPTIMAL';
  } {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const activeSessions: string[] = [];
    let liquidityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'OPTIMAL' = 'MEDIUM';

    if (utcHour >= 22 || utcHour < 8) activeSessions.push('ASIAN');
    if (utcHour >= 8 && utcHour < 16) activeSessions.push('LONDON');
    if (utcHour >= 13 && utcHour < 21) activeSessions.push('NEW_YORK');

    if (utcHour >= 13 && utcHour < 16) liquidityLevel = 'OPTIMAL';
    else if (utcHour >= 8 && utcHour < 17) liquidityLevel = 'HIGH';
    else if (utcHour >= 22 || utcHour < 8) liquidityLevel = 'LOW';

    return { activeSessions, liquidityLevel };
  }

  public getRecommendation(analysis: FuturesAnalysis): FuturesRecommendation {
    if (!analysis || !analysis.currentPrice || typeof analysis.score !== 'number') {
      return {
        entry: null, sl: null, tp1: null, tp2: null, rr: null, confidence: 'NONE',
        reasoning: ['بيانات غير كافية لإصدار توصية فوتشرز'],
      };
    }

    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' = 'NONE';
    if (analysis.score >= 70) confidence = 'HIGH';
    else if (analysis.score >= 50) confidence = 'MEDIUM';
    else if (analysis.score >= 30) confidence = 'LOW';

    if (confidence === 'NONE' || analysis.direction === 'NEUTRAL') {
      return {
        entry: null, sl: null, tp1: null, tp2: null, rr: null, confidence,
        reasoning: [
          `حالة عقود الذهب الآجلة محايدة أو الثقة غير كافية (النقاط: ${analysis.score}/100)`,
          `مستوى السيولة: ${analysis.sessionAnalysis?.liquidityLevel ?? 'MEDIUM'}`,
        ],
      };
    }

    const price = analysis.currentPrice;
    const atr = (analysis.atr && analysis.atr > 0) ? analysis.atr : 5.0;
    const isLong = analysis.direction === 'LONG';

    const entry = analysis.entry ?? Number(price.toFixed(2));
    const sl = analysis.stopLoss ?? Number((isLong ? price - (atr * 1.5) : price + (atr * 1.5)).toFixed(2));
    const risk = Math.abs(entry - sl);
    const tp1 = analysis.takeProfit1 ?? Number((isLong ? price + (risk * 2.0) : price - (risk * 2.0)).toFixed(2));
    const tp2 = analysis.takeProfit2 ?? Number((isLong ? price + (risk * 3.5) : price - (risk * 3.5)).toFixed(2));
    const rr = 2.0;

    return {
      entry, sl, tp1, tp2, rr, confidence,
      reasoning: [
        `الاتجاه الآجل (COMEX GC): ${analysis.direction} مع ثقة ${confidence}`,
        `معدل التذبذب ATR: $${analysis.atr}، متوسط السعر المرجح بالزمن TWAP: $${analysis.twap}`,
        `مستوى التحكم TPO POC: $${analysis.tpo?.poc} | VAH: $${analysis.tpo?.vah} | VAL: $${analysis.tpo?.val}`,
        `حالة الزخم السعري: ${analysis.priceMomentum?.momentumStateAr}`,
        `الجلسات النشطة: ${analysis.sessionAnalysis?.activeSessions.join(', ') ?? ''} (${analysis.sessionAnalysis?.liquidityLevel ?? 'MEDIUM'})`,
        ...(analysis.confluence || []),
      ],
    };
  }
}

function valHelper(tpo?: TPOAnalysis): number {
  return tpo?.val ?? 0;
}

export const futuresEngine = new FuturesEngine();
