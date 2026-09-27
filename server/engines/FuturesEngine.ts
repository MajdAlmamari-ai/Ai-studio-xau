/**
 * Futures Engine — COMEX:GC1! (TradingView)
 * 
 * Primary analysis engine for Gold Futures with SMC Structure & CVD.
 * 
 * DATA SOURCE:
 * - Symbol: COMEX:GC1!
 * - Type: FuturesPrice (Branded Type)
 * - Role: Analysis (Structure, Volume, CVD)
 * 
 * NO FAKE DATA:
 * - All inputs from CandleRepository (futures_candles) or direct FuturesCandle[]
 * - All outputs validated by PriceSourceEnforcer
 * - DataUnavailableError on failure
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
import { calculateInstitutionalDelta } from '../priceVolumeEngine';
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
  cvd?: {
    cumulativeDelta: number;
    buyVolume: number;
    sellVolume: number;
    source?: string;
  };
  openInterest?: number;
  atr?: number;
  vwap?: number;
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

  /**
   * Pure SMC + CVD analysis on provided FuturesCandle[]
   */
  public analyzeCandles(candles: FuturesCandle[]): FuturesAnalysis {
    // STEP 1: Validate input
    if (!candles || candles.length < 30) {
      throw new DataUnavailableError(
        'INSUFFICIENT_CANDLES',
        `Need at least 30 futures candles, got ${candles?.length ?? 0}`
      );
    }

    // Validate each candle using PriceSourceEnforcer
    for (const c of candles) {
      PriceSourceEnforcer.enforceFutures(c);
    }

    // STEP 2: Compute ATR (from real candles)
    const atr = this.calculateATR(candles, 14);

    // STEP 3: Detect Swings
    const swings = this.detectSwings(candles);

    // STEP 4: Detect Structure (BOS/CHoCH)
    const structure = this.detectStructure(candles, swings, atr);

    // STEP 5: Detect Order Blocks
    const obs = this.detectOrderBlocks(candles, atr, structure);

    // STEP 6: Detect FVG
    const fvgs = this.detectFVG(candles, atr);

    // STEP 7: Detect Liquidity Sweeps
    const sweeps = this.detectSweeps(candles, atr);

    // STEP 8: Calculate CVD
    const cvd = this.calculateCVD(candles);

    // STEP 9: Extract Open Interest if available
    const lastCandleWithOi = [...candles].reverse().find((c) => typeof c.openInterest === 'number');
    const openInterest = lastCandleWithOi?.openInterest;

    // STEP 10: Calculate score
    const score = this.calculateScore({ structure, sweeps, obs, fvgs, cvd });

    // STEP 11: Build analysis
    return this.buildAnalysis(candles, structure, score, obs, fvgs, sweeps, cvd, atr, openInterest);
  }

  /**
   * Overloaded analyze method:
   * Can accept timeframe string (fetching from CandleRepository) OR FuturesCandle[]
   */
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
        'FUTURES_CANDLES_INSUFFICIENT',
        `Only ${rawCandles?.length ?? 0} futures candles available (min 30)`
      );
    }

    const candles: FuturesCandle[] = rawCandles.map((c) =>
      PriceSourceEnforcer.enforceFutures({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        openInterest: c.openInterest,
        source: 'FUTURES',
      })
    );

    return this.analyzeCandles(candles);
  }

  public calculateATR(candles: FuturesCandle[], period: number = 14): number {
    if (candles.length < period + 1) {
      throw new DataUnavailableError(
        'ATR_INSUFFICIENT_DATA',
        `Need at least ${period + 1} candles`
      );
    }

    const atrSeries = calculateATR(candles as any, period);
    const lastAtr = atrSeries[atrSeries.length - 1];

    if (typeof lastAtr !== 'number' || !isFinite(lastAtr)) {
      throw new DataUnavailableError('ATR_CALCULATION_FAILED', 'Failed to calculate ATR');
    }

    return Number(lastAtr.toFixed(2));
  }

  public detectSwings(candles: FuturesCandle[]): ConfirmedSwing[] {
    return detectSwings(candles as any, DEFAULT_ENGINE_CONFIG.swingConfig);
  }

  public detectStructure(candles: FuturesCandle[], swings: ConfirmedSwing[], _atr: number): StructureBreak[] {
    const atrSeries = calculateATR(candles as any, 14);
    return detectBreaks(candles as any, swings, atrSeries, DEFAULT_ENGINE_CONFIG.breakConfig);
  }

  public detectOrderBlocks(candles: FuturesCandle[], _atr: number, breaks: StructureBreak[]): OrderBlock[] {
    const atrSeries = calculateATR(candles as any, 14);
    const rawObs = detectOrderBlocks(candles as any, atrSeries, breaks, DEFAULT_ENGINE_CONFIG.obConfig);
    return replayOBLifecycle(rawObs, candles as any);
  }

  public detectFVG(candles: FuturesCandle[], _atr: number): FVGZone[] {
    const atrSeries = calculateATR(candles as any, 14);
    const rawFvgs = detectFVGs(candles as any, atrSeries, DEFAULT_ENGINE_CONFIG.fvgConfig);
    return replayFVGLifecycle(rawFvgs, candles as any);
  }

  public detectSweeps(candles: FuturesCandle[], _atr: number): SweepEvent[] {
    const atrSeries = calculateATR(candles as any, 14);
    const levels = detectLiquidityLevels(candles as any);
    return detectSweeps(candles as any, atrSeries, levels, DEFAULT_ENGINE_CONFIG.liquidityConfig);
  }

  public calculateCVD(candles: FuturesCandle[]): {
    cumulativeDelta: number;
    buyVolume: number;
    sellVolume: number;
    source: 'INSTITUTIONAL_DELTA_APPROXIMATION';
  } {
    let cumulativeDelta = 0;
    let buyVolume = 0;
    let sellVolume = 0;

    for (const candle of candles) {
      const delta = calculateInstitutionalDelta({
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      });

      cumulativeDelta += delta;

      if (delta >= 0) {
        buyVolume += delta;
      } else {
        sellVolume += Math.abs(delta);
      }
    }

    return {
      cumulativeDelta: Number(cumulativeDelta.toFixed(2)),
      buyVolume: Number(buyVolume.toFixed(2)),
      sellVolume: Number(sellVolume.toFixed(2)),
      source: 'INSTITUTIONAL_DELTA_APPROXIMATION',
    };
  }

  public calculateScore(parts: {
    structure: StructureBreak[];
    sweeps: SweepEvent[];
    obs: OrderBlock[];
    fvgs: FVGZone[];
    cvd: { cumulativeDelta: number; buyVolume: number; sellVolume: number };
  }): number {
    let score = 50;

    // Structure weight
    const lastBreak = parts.structure[parts.structure.length - 1];
    if (lastBreak) {
      if (lastBreak.type === 'BOS_UP' || lastBreak.type === 'CHOCH_UP') score += 15;
      else if (lastBreak.type === 'BOS_DOWN' || lastBreak.type === 'CHOCH_DOWN') score -= 15;
    }

    // Sweeps weight
    const lastSweep = parts.sweeps[parts.sweeps.length - 1];
    if (lastSweep) {
      if (lastSweep.direction === 'SWEEP_DOWN' && lastSweep.reclaimed) score += 15;
      else if (lastSweep.direction === 'SWEEP_UP' && lastSweep.reclaimed) score -= 15;
    }

    // Active unmitigated OBs & FVGs
    const activeObs = parts.obs.filter((ob) => ob.status === 'ACTIVE');
    const bullishObs = activeObs.filter((ob) => ob.direction === 'BULLISH').length;
    const bearishObs = activeObs.filter((ob) => ob.direction === 'BEARISH').length;
    score += (bullishObs - bearishObs) * 5;

    // CVD confirmation weight
    if (parts.cvd.cumulativeDelta > 500) score += 10;
    else if (parts.cvd.cumulativeDelta < -500) score -= 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  public buildAnalysis(
    candles: FuturesCandle[],
    structure: StructureBreak[],
    score: number,
    obs: OrderBlock[],
    fvgs: FVGZone[],
    sweeps: SweepEvent[],
    cvd: { cumulativeDelta: number; buyVolume: number; sellVolume: number; source: string },
    atr: number,
    openInterest?: number
  ): FuturesAnalysis {
    const lastCandle = candles[candles.length - 1];
    const currentPrice = lastCandle.close;
    const vwap = this.calculateVWAP(candles);
    const sessionAnalysis = this.analyzeSessions();

    let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
    if (score >= 60) direction = 'LONG';
    else if (score <= 40) direction = 'SHORT';

    const confluence: string[] = [];
    const lastBreak = structure[structure.length - 1];
    if (lastBreak) {
      confluence.push(`Market Structure Break (${lastBreak.type})`);
    }

    const lastSweep = sweeps[sweeps.length - 1];
    if (lastSweep) {
      confluence.push(`Liquidity Sweep detected (${lastSweep.direction})`);
    }

    const unmitigatedObs = obs.filter((o) => o.status === 'ACTIVE').length;
    if (unmitigatedObs > 0) {
      confluence.push(`${unmitigatedObs} Active Futures Order Blocks`);
    }

    const unmitigatedFvgs = fvgs.filter((f) => f.status === 'ACTIVE').length;
    if (unmitigatedFvgs > 0) {
      confluence.push(`${unmitigatedFvgs} Active Futures Fair Value Gaps`);
    }

    if (cvd.cumulativeDelta !== 0) {
      confluence.push(`CVD Delta: ${cvd.cumulativeDelta > 0 ? '+' : ''}${cvd.cumulativeDelta}`);
    }

    let entry: number | undefined;
    let stopLoss: number | undefined;
    let takeProfit1: number | undefined;
    let takeProfit2: number | undefined;

    if (direction !== 'NEUTRAL') {
      const isLong = direction === 'LONG';
      entry = Number(currentPrice.toFixed(2));
      const slDist = Math.max(atr * 1.5, 3.0);
      stopLoss = Number((isLong ? entry - slDist : entry + slDist).toFixed(2));
      const risk = Math.abs(entry - stopLoss);
      takeProfit1 = Number((isLong ? entry + risk * 2.0 : entry - risk * 2.0).toFixed(2));
      takeProfit2 = Number((isLong ? entry + risk * 3.5 : entry - risk * 3.5).toFixed(2));
    }

    return {
      symbol: 'COMEX:GC1!',
      currentPrice,
      direction,
      score,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
      confluence,
      cvd,
      openInterest: typeof openInterest === 'number' ? openInterest : undefined,
      atr,
      vwap,
      sessionAnalysis,
      timestamp: Date.now(),
    };
  }

  public calculateVWAP(candles: FuturesCandle[]): number {
    let sumPriceVolume = 0;
    let sumVolume = 0;

    for (const candle of candles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      sumPriceVolume += typicalPrice * candle.volume;
      sumVolume += candle.volume;
    }

    if (sumVolume === 0) {
      throw new DataUnavailableError(
        'VWAP_UNAVAILABLE',
        'No volume data available'
      );
    }

    return Number((sumPriceVolume / sumVolume).toFixed(2));
  }

  public analyzeSessions(): {
    activeSessions: string[];
    liquidityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'OPTIMAL';
  } {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const activeSessions: string[] = [];
    let liquidityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'OPTIMAL' = 'MEDIUM';

    if (utcHour >= 22 || utcHour < 8) {
      activeSessions.push('ASIAN');
    }

    if (utcHour >= 8 && utcHour < 16) {
      activeSessions.push('LONDON');
    }

    if (utcHour >= 13 && utcHour < 21) {
      activeSessions.push('NEW_YORK');
    }

    if (utcHour >= 13 && utcHour < 16) {
      liquidityLevel = 'OPTIMAL';
    } else if (utcHour >= 8 && utcHour < 17) {
      liquidityLevel = 'HIGH';
    } else if (utcHour >= 22 || utcHour < 8) {
      liquidityLevel = 'LOW';
    }

    return { activeSessions, liquidityLevel };
  }

  public getRecommendation(analysis: FuturesAnalysis): FuturesRecommendation {
    if (!analysis || !analysis.currentPrice || typeof analysis.score !== 'number') {
      return {
        entry: null,
        sl: null,
        tp1: null,
        tp2: null,
        rr: null,
        confidence: 'NONE',
        reasoning: ['بيانات غير كافية لإصدار توصية فوتشرز'],
      };
    }

    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' = 'NONE';
    if (analysis.score >= 70) {
      confidence = 'HIGH';
    } else if (analysis.score >= 50) {
      confidence = 'MEDIUM';
    } else if (analysis.score >= 30) {
      confidence = 'LOW';
    } else {
      confidence = 'NONE';
    }

    if (confidence === 'NONE' || analysis.direction === 'NEUTRAL') {
      return {
        entry: null,
        sl: null,
        tp1: null,
        tp2: null,
        rr: null,
        confidence,
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
      entry,
      sl,
      tp1,
      tp2,
      rr,
      confidence,
      reasoning: [
        `الاتجاه الآجل (COMEX GC): ${analysis.direction} مع ثقة ${confidence}`,
        `معدل التذبذب ATR: $${analysis.atr}، متوسط السعر المرجح VWAP: $${analysis.vwap}`,
        `دلتا تدفق الأوامر التراكمي CVD: ${analysis.cvd?.cumulativeDelta ?? 0}`,
        `الجلسات النشطة: ${analysis.sessionAnalysis?.activeSessions.join(', ') ?? ''} (${analysis.sessionAnalysis?.liquidityLevel ?? 'MEDIUM'})`,
        ...(analysis.confluence || []),
      ],
    };
  }
}

export const futuresEngine = new FuturesEngine();
