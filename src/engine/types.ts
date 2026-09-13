/**
 * Engine types for Real SMC Analysis.
 * Internal to the engine. May be mapped to src/types.ts.
 */

import { NormalizedCandle } from '../../server/gateIoService';

export type { NormalizedCandle };

/**
 * ATR result aligned with input candles.
 * Index i corresponds to candles[i].
 * null means ATR not yet available (warmup period).
 */
export type AtrArray = ReadonlyArray<number | null>;

/**
 * Default ATR period (Wilder).
 */
export const ATR_PERIOD = 14;

/**
 * Spring Coil metadata computed alongside ATR.
 * Used by compressionWickService for compression detection.
 */
export interface SpringCoilMeta {
  /** Current ATR value (most recent). */
  currentATR: number | null;
  /** Lowest ATR value in the last N candles (default 20). */
  lowestATR20: number | null;
  /** Ratio currentATR / lowestATR20. <1.15 typically indicates compression. */
  springCoilRatio: number | null;
  /** True if springCoilRatio <= 1.15. */
  isSpringCoilActive: boolean;
}

/**
 * Combined ATR result.
 */
export interface AtrResult {
  /** Full ATR array (one per candle, null during warmup). */
  atr: AtrArray;
  /** Spring Coil metadata. */
  springCoil: SpringCoilMeta;
}

export type SwingType = 'HIGH' | 'LOW';

export interface ConfirmedSwing {
  readonly type: SwingType;
  readonly index: number;
  readonly time: number;
  readonly price: number;
  readonly confirmedAtIndex: number;
}

export interface SwingDetectionConfig {
  readonly leftBars: number;
  readonly rightBars: number;
}

export type PriorRegime = 'UPTREND' | 'DOWNTREND' | 'RANGE' | 'UNKNOWN';

export type StructureBreakType =
  | 'BOS_UP'
  | 'BOS_DOWN'
  | 'CHOCH_UP'
  | 'CHOCH_DOWN'
  | 'FAILED_BREAK';

export interface StructureBreak {
  readonly type: StructureBreakType;
  /** The swing level that was broken. */
  readonly level: number;
  /** Index of the swing that was broken. */
  readonly swingIndex: number;
  /** Index of the candle that closed through the level. */
  readonly breakIndex: number;
  /** Time of the break candle. */
  readonly breakTime: number;
  /** |close - level| / atr at breakIndex. */
  readonly strengthAtr: number;
  /** Regime before the break. */
  readonly priorRegime: PriorRegime;
  /** Confirmed at breakIndex (break is immediate on close). */
  readonly confirmedAtIndex: number;
}

export interface BreakDetectionConfig {
  readonly minStrengthAtr: number;
  readonly leftBars: number;
  readonly rightBars: number;
}

export const DEFAULT_BREAK_CONFIG: BreakDetectionConfig = {
  minStrengthAtr: 0.3,
  leftBars: 2,
  rightBars: 2,
};

export type FVGDirection = 'BULLISH' | 'BEARISH';

export type FVGStatus = 'ACTIVE' | 'PARTIAL' | 'FULL_FILLED' | 'INVALIDATED';

export interface FVGZone {
  readonly id: string;
  readonly direction: FVGDirection;
  readonly bottom: number;
  readonly top: number;
  readonly size: number;
  /** Index of the third candle (C) that formed the FVG. */
  readonly createdAtIndex: number;
  /** Time of the third candle. */
  readonly createdAt: number;
  /** Current status. */
  readonly status: FVGStatus;
  /** Index of first candle to touch the zone, or null. */
  readonly firstTouchIndex: number | null;
  /** Index where zone became fully filled, or null. */
  readonly fullFillIndex: number | null;
  /** Index where zone was invalidated, or null. */
  readonly invalidationIndex: number | null;
  /** Confirmed as of this index. Equals createdAtIndex initially. */
  readonly confirmedAtIndex: number;
}

export interface FVGDetectionConfig {
  /** Minimum gap size as a fraction of ATR at creation. */
  readonly minGapAtrRatio: number;
}

export const DEFAULT_FVG_CONFIG: FVGDetectionConfig = {
  minGapAtrRatio: 0.15,
};

export type OBDirection = 'BULLISH' | 'BEARISH';

export type OBStatus = 'ACTIVE' | 'MITIGATED' | 'INVALIDATED';

export interface OrderBlock {
  readonly id: string;
  readonly direction: OBDirection;
  /** Lower bound of the OB zone. */
  readonly bottom: number;
  /** Upper bound of the OB zone. */
  readonly top: number;
  /** Origin candle index. */
  readonly originIndex: number;
  /** Origin candle time. */
  readonly originTime: number;
  /** Break candle index (the one that confirmed the OB). */
  readonly breakIndex: number;
  /** Break type that confirmed this OB. */
  readonly breakType: 'BOS_UP' | 'BOS_DOWN';
  /** Displacement score: break candle body / ATR. */
  readonly displacementAtr: number;
  /** Current status. */
  readonly status: OBStatus;
  /** Number of times price re-entered the zone. */
  readonly mitigationCount: number;
  /** Index of first mitigation, or null. */
  readonly firstMitigationIndex: number | null;
  /** Index of last mitigation, or null. */
  readonly lastMitigationIndex: number | null;
  /** Index where OB was invalidated, or null. */
  readonly invalidationIndex: number | null;
  /** Confirmed as of this index. Equals breakIndex initially. */
  readonly confirmedAtIndex: number;
}

export interface OBDetectionConfig {
  /** Max candles to look back for the origin candle. */
  readonly maxLookback: number;
  /** Minimum break candle body as fraction of ATR. */
  readonly minDisplacementAtr: number;
  /** Maximum origin range as fraction of ATR. */
  readonly maxOriginRangeAtr: number;
}

export const DEFAULT_OB_CONFIG: OBDetectionConfig = {
  maxLookback: 10,
  minDisplacementAtr: 0.5,
  maxOriginRangeAtr: 3.0,
};

export type LiquidityLevelType =
  | 'PDH'
  | 'PDL'
  | 'PWH'
  | 'PWL'
  | 'ASIAN_HIGH'
  | 'ASIAN_LOW'
  | 'LONDON_HIGH'
  | 'LONDON_LOW'
  | 'NY_HIGH'
  | 'NY_LOW'
  | 'EQUAL_HIGHS'
  | 'EQUAL_LOWS'
  | 'SESSION_HIGH'
  | 'SESSION_LOW';

export interface LiquidityLevel {
  readonly id: string;
  readonly type: LiquidityLevelType;
  readonly price: number;
  readonly createdAt: number;
  readonly createdAtIndex: number;
  readonly source: string;
  /** Confirmed as of this index. */
  readonly confirmedAtIndex: number;
}

export type SweepDirection = 'SWEEP_UP' | 'SWEEP_DOWN';

export interface SweepEvent {
  readonly id: string;
  readonly direction: SweepDirection;
  readonly levelId: string;
  readonly levelPrice: number;
  readonly candleIndex: number;
  readonly candleTime: number;
  /** Penetration in ATR units. */
  readonly penetrationAtr: number;
  /** Reclaim in ATR units (close back inside the level). */
  readonly reclaimAtr: number;
  /** True if price closed back inside the level. */
  readonly reclaimed: boolean;
}

export interface LiquidityDetectionConfig {
  /** Tolerance for Equal Highs / Lows, in ATR units. */
  readonly equalToleranceAtr: number;
  /** Minimum penetration beyond a level, in ATR units. */
  readonly sweepAlphaAtr: number;
}

export const DEFAULT_LIQUIDITY_CONFIG: LiquidityDetectionConfig = {
  equalToleranceAtr: 0.15,
  sweepAlphaAtr: 0.2,
};

export type Regime =
  | 'TREND_UP'
  | 'TREND_DOWN'
  | 'RANGE'
  | 'NORMAL_VOLATILITY'
  | 'HIGH_VOLATILITY'
  | 'LOW_LIQUIDITY'
  | 'NEWS_RISK'
  | 'UNKNOWN';

export interface RegimeContext {
  readonly regime: Regime;
  readonly classifiedAtIndex: number;
  readonly atrCurrent: number | null;
  readonly atrMedian: number | null;
  readonly atrRatio: number | null;
  readonly barsUsed: number;
  readonly reasonCodes: readonly string[];
}

export interface RegimeConfig {
  readonly minBars: number;
  readonly medianLookback: number;
  readonly highVolMultiplier: number;
  readonly lowVolMultiplier: number;
  readonly trendSwingLookback: number;
}

export const DEFAULT_REGIME_CONFIG: RegimeConfig = {
  minBars: 50,
  medianLookback: 100,
  highVolMultiplier: 1.5,
  lowVolMultiplier: 0.5,
  trendSwingLookback: 4,
};

export interface ConfluenceFeatures {
  readonly structureAligned: boolean;
  readonly regimeTrending: boolean;
  readonly fvgNearby: boolean;
  readonly obNearby: boolean;
  readonly liquiditySweepRecent: boolean;
  readonly priceInDiscount: boolean | null;
  readonly higherTimeframeAligned: boolean | null;
}

export interface ConfluenceResult {
  readonly score: number;
  readonly eligible: boolean;
  readonly features: ConfluenceFeatures;
  readonly reasonCodes: readonly string[];
}

export interface ConfluenceConfig {
  readonly minEligibleScore: number;
  readonly proximityAtr: number;
  readonly sweepRecencyBars: number;
  readonly weightStructure: number;
  readonly weightRegime: number;
  readonly weightFvg: number;
  readonly weightOb: number;
  readonly weightSweep: number;
  readonly weightDiscount: number;
}

export const DEFAULT_CONFLUENCE_CONFIG: ConfluenceConfig = {
  minEligibleScore: 60,
  proximityAtr: 2.0,
  sweepRecencyBars: 10,
  weightStructure: 25,
  weightRegime: 20,
  weightFvg: 15,
  weightOb: 15,
  weightSweep: 15,
  weightDiscount: 10,
};

export interface EngineConfig {
  readonly atrPeriod: number;
  readonly swingConfig: SwingDetectionConfig;
  readonly breakConfig: BreakDetectionConfig;
  readonly fvgConfig: FVGDetectionConfig;
  readonly obConfig: OBDetectionConfig;
  readonly liquidityConfig: LiquidityDetectionConfig;
  readonly regimeConfig: RegimeConfig;
  readonly confluenceConfig: ConfluenceConfig;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  atrPeriod: 14,
  swingConfig: { leftBars: 2, rightBars: 2 },
  breakConfig: DEFAULT_BREAK_CONFIG,
  fvgConfig: DEFAULT_FVG_CONFIG,
  obConfig: DEFAULT_OB_CONFIG,
  liquidityConfig: DEFAULT_LIQUIDITY_CONFIG,
  regimeConfig: DEFAULT_REGIME_CONFIG,
  confluenceConfig: DEFAULT_CONFLUENCE_CONFIG,
};

export interface RealSMCAnalysis {
  /** As-of index used for analysis. */
  readonly asOfIndex: number;
  /** As-of time (from candles[asOfIndex].time). */
  readonly asOfTime: number;
  /** Current close price. */
  readonly currentPrice: number;
  /** ATR array (full series). */
  readonly atr: AtrArray;
  /** Latest ATR value. */
  readonly atrCurrent: number | null;
  /** Confirmed swings. */
  readonly swings: ReadonlyArray<ConfirmedSwing>;
  /** Structure breaks. */
  readonly breaks: ReadonlyArray<StructureBreak>;
  /** FVG zones. */
  readonly fvgs: ReadonlyArray<FVGZone>;
  /** Order blocks. */
  readonly orderBlocks: ReadonlyArray<OrderBlock>;
  /** Liquidity levels. */
  readonly levels: ReadonlyArray<LiquidityLevel>;
  /** Sweep events. */
  readonly sweeps: ReadonlyArray<SweepEvent>;
  /** Regime context. */
  readonly regime: RegimeContext;
  /** Confluence result. */
  readonly confluence: ConfluenceResult;
  /** Reason codes aggregated from all modules. */
  readonly reasonCodes: readonly string[];
}
