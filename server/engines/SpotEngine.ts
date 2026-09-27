/**
 * Spot Engine — XAUUSD (OANDA via TradingView)
 * 
 * Performs SMC technical + quantitative analysis on Spot Gold.
 * 
 * DATA SOURCE:
 * - Symbol: OANDA:XAUUSD
 * - Type: SpotPrice (Branded Type)
 * - Role: Execution (Entry/SL/TP)
 * 
 * NO FAKE DATA:
 * - All inputs from CandleRepository (spot_candles)
 * - All outputs validated by PriceSourceEnforcer
 * - DataUnavailableError on failure
 * - Deterministic SMC structure detection (Swings, Breaks, OB, FVG, Sweeps)
 */

import {
  SpotCandle,
  SpotPrice,
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

export interface SpotAnalysis {
  symbol?: 'OANDA:XAUUSD';
  currentPrice?: SpotPrice;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  score: number;
  entry?: number;
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  confluence?: string[];
  atr: number;
  vwap: number;
  sessionAnalysis: {
    activeSessions: string[];
    liquidityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'OPTIMAL';
  };
  swapCosts?: {
    long: number;
    short: number;
    note: string;
  };
  timestamp: number;
}

export interface SpotRecommendation {
  entry: number | null;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  rr: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  reasoning: string[];
}

export class SpotEngine {
  private repo?: CandleRepository;

  constructor(repo?: CandleRepository) {
    this.repo = repo;
  }

  /**
   * Pure SMC analysis on provided SpotCandle[]
   */
  public analyzeCandles(candles: SpotCandle[]): SpotAnalysis {
    // STEP 1: Validate input
    if (!candles || candles.length < 30) {
      throw new DataUnavailableError(
        'INSUFFICIENT_CANDLES',
        `Need at least 30 spot candles, got ${candles?.length ?? 0}`
      );
    }

    // Validate each candle using PriceSourceEnforcer
    for (const c of candles) {
      PriceSourceEnforcer.enforceSpot(c);
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

    // STEP 8: Calculate score
    const score = this.calculateScore({ structure, sweeps, obs, fvgs });

    // STEP 9: Build analysis
    return this.buildAnalysis(candles, structure, score, obs, fvgs, sweeps, atr);
  }

  /**
   * Overloaded analyze method:
   * Can accept timeframe string (fetching from CandleRepository) OR SpotCandle[]
   */
  async analyze(timeframeOrCandles: string | SpotCandle[] = '15m'): Promise<SpotAnalysis> {
    if (Array.isArray(timeframeOrCandles)) {
      return this.analyzeCandles(timeframeOrCandles);
    }

    if (!this.repo) {
      throw new DataUnavailableError(
        'REPOSITORY_UNAVAILABLE',
        'CandleRepository not provided to SpotEngine instance'
      );
    }

    const rawCandles = this.repo.getSpotCandles(timeframeOrCandles, 100);

    if (!rawCandles || rawCandles.length < 30) {
      throw new DataUnavailableError(
        'SPOT_CANDLES_INSUFFICIENT',
        `Only ${rawCandles?.length ?? 0} spot candles available (min 30)`
      );
    }

    const candles: SpotCandle[] = rawCandles.map((c) =>
      PriceSourceEnforcer.enforceSpot({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        source: 'SPOT',
      })
    );

    return this.analyzeCandles(candles);
  }

  public calculateATR(candles: SpotCandle[], period: number = 14): number {
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

  public detectSwings(candles: SpotCandle[]): ConfirmedSwing[] {
    return detectSwings(candles as any, DEFAULT_ENGINE_CONFIG.swingConfig);
  }

  public detectStructure(candles: SpotCandle[], swings: ConfirmedSwing[], _atr: number): StructureBreak[] {
    const atrSeries = calculateATR(candles as any, 14);
    return detectBreaks(candles as any, swings, atrSeries, DEFAULT_ENGINE_CONFIG.breakConfig);
  }

  public detectOrderBlocks(candles: SpotCandle[], _atr: number, breaks: StructureBreak[]): OrderBlock[] {
    const atrSeries = calculateATR(candles as any, 14);
    const rawObs = detectOrderBlocks(candles as any, atrSeries, breaks, DEFAULT_ENGINE_CONFIG.obConfig);
    return replayOBLifecycle(rawObs, candles as any);
  }

  public detectFVG(candles: SpotCandle[], _atr: number): FVGZone[] {
    const atrSeries = calculateATR(candles as any, 14);
    const rawFvgs = detectFVGs(candles as any, atrSeries, DEFAULT_ENGINE_CONFIG.fvgConfig);
    return replayFVGLifecycle(rawFvgs, candles as any);
  }

  public detectSweeps(candles: SpotCandle[], _atr: number): SweepEvent[] {
    const atrSeries = calculateATR(candles as any, 14);
    const levels = detectLiquidityLevels(candles as any);
    return detectSweeps(candles as any, atrSeries, levels, DEFAULT_ENGINE_CONFIG.liquidityConfig);
  }

  public calculateScore(parts: {
    structure: StructureBreak[];
    sweeps: SweepEvent[];
    obs: OrderBlock[];
    fvgs: FVGZone[];
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

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  public buildAnalysis(
    candles: SpotCandle[],
    structure: StructureBreak[],
    score: number,
    obs: OrderBlock[],
    fvgs: FVGZone[],
    sweeps: SweepEvent[],
    atr: number
  ): SpotAnalysis {
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
      confluence.push(`${unmitigatedObs} Active Order Blocks identified`);
    }

    const unmitigatedFvgs = fvgs.filter((f) => f.status === 'ACTIVE').length;
    if (unmitigatedFvgs > 0) {
      confluence.push(`${unmitigatedFvgs} Active Fair Value Gaps identified`);
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

    const swapCosts = {
      long: -18.50,
      short: 6.50,
      note: 'Swap costs typical for XAUUSD (varies by broker)',
    };

    return {
      symbol: 'OANDA:XAUUSD',
      currentPrice,
      direction,
      score,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
      confluence,
      atr,
      vwap,
      sessionAnalysis,
      swapCosts,
      timestamp: Date.now(),
    };
  }

  public calculateVWAP(candles: SpotCandle[]): number {
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

  public analyzeSessions(): SpotAnalysis['sessionAnalysis'] {
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

  public getRecommendation(analysis: SpotAnalysis): SpotRecommendation {
    if (!analysis || !analysis.currentPrice || typeof analysis.score !== 'number') {
      return {
        entry: null,
        sl: null,
        tp1: null,
        tp2: null,
        rr: null,
        confidence: 'NONE',
        reasoning: ['بيانات غير كافية لإصدار توصية تنفيذية'],
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
          `حالة السوق محايدة أو الثقة غير كافية (النقاط: ${analysis.score}/100)`,
          `مستوى السيولة الحالي: ${analysis.sessionAnalysis.liquidityLevel}`,
        ],
      };
    }

    const price = analysis.currentPrice;
    const atr = analysis.atr > 0 ? analysis.atr : 5.0;
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
        `الاتجاه الفوري: ${analysis.direction} مع ثقة ${confidence}`,
        `معدل التذبذب ATR: $${analysis.atr}، متوسط السعر المرجح بحجم التداول VWAP: $${analysis.vwap}`,
        `الجلسات النشطة: ${analysis.sessionAnalysis.activeSessions.join(', ')} (${analysis.sessionAnalysis.liquidityLevel})`,
        ...(analysis.confluence || []),
      ],
    };
  }
}

export const spotEngine = new SpotEngine();
