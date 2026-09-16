import type { Regime } from './engine/types';

export interface VSAAbsorptionData {
  candleVolume: number;
  priceRange: number;
  absorptionRatio: number; // Candle_Volume / Price_Range
  candleTime: string;
  candleOpen: number;
  candleClose: number;
  candleHigh: number;
  candleLow: number;
  state: 'HIGH_ABSORPTION' | 'MODERATE_ABSORPTION' | 'LOW_ABSORPTION';
  stateLabelAr: string;
  descriptionAr: string;
}

export interface GoldPriceData {
  price: number;
  currency: string;
  symbol: string;
  name: string;
  updatedAt: string;
  source: 'gateio_cfd' | 'gateio_spot' | 'live_api' | 'fallback' | 'scenario' | 'tencent_gc' | 'eastmoney_gc' | 'cloud_engine' | 'gold-api' | 'tradingview' | 'yahoo_gc';
  isOffline?: boolean;
  statusMessageAr?: string;
  change24h?: number;
  high24h?: number | null;
  low24h?: number | null;
  bid?: number | null;
  ask?: number | null;
  spreadPoints?: number | null;
  spreadPips?: number | null;
  spreadOffset?: number;
  spreadOffsetFormatted?: string;
  referencePrice?: number | null;
  vsa?: VSAAbsorptionData;
  pricingMode?: 'gateio_cfd' | 'gateio_spot' | 'manual';
  cfdPrice?: number;
  spotPrice?: number;
  basisSpread?: number;
  autoCalibrated?: boolean;
  // Legacy compatibility
  mt5Bid?: number | null;
  mt5Ask?: number | null;
  mt5SpreadPoints?: number | null;
  mt5SpreadPips?: number | null;
}

export interface FuturesPriceData {
  contract: string; // e.g., 'GC (Comex Gold Futures)'
  futuresPrice: number | null;
  spotPrice: number | null;
  basisSpread: number | null; // futures - spot
  basisState: 'CONTANGO' | 'BACKWARDATION' | 'OFFLINE';
  expiryDate: string;
  volume: number;
  openInterest: number;
  updatedAt: string;
  cmeVolumeLots?: number;
  openInterestContracts?: number;
}

// 1. Order Flow & Real Volume Confluence
export interface OrderFlowVolumeData {
  spotPrice: number;
  futuresPrice: number;
  cmeRealVolume: number;
  tickVolume: number;
  cvdDelta: number; // Cumulative Volume Delta
  deltaBias: 'STRONG_BUYERS' | 'STRONG_SELLERS' | 'ABSORPTION' | 'NEUTRAL';
  imbalanceRatio: number; // e.g., 2.45x
  cotCommercialsNet: string; // Net Commercials positioning
  cotNonCommercialsNet: string; // Speculators
  confluenceConfirmed: boolean;
  notesAr: string;
}

// 2. Post-News Liquidity Sweep Module
export interface PostNewsSweepData {
  activeNewsTitleAr: string;
  newsReleaseTime: string;
  newsCandleHigh: number;
  newsCandleLow: number;
  currentPrice: number;
  sweepDetected: boolean;
  sweepType: 'BULLISH_SWEEP_REVERSAL' | 'BEARISH_SWEEP_REVERSAL' | 'NONE';
  cooldownRemainingMinutes: number; // 15-minute wait rule
  actionableSignal: 'BUY_AFTER_SWEEP' | 'SELL_AFTER_SWEEP' | 'WAIT_COOLDOWN' | 'NO_SWEEP';
  explanationAr: string;
}

// 3. Price Compression & Spring Coil Engine
export interface CompressionMetrics {
  isCompressed: boolean;
  current1hATR: number;
  lowestAtr20Period: number;
  compressionRatioPct: number; // Lowest ATR / Current ATR
  springState: 'COMPRESSED_COIL' | 'EXPANSION_TRIGGERED' | 'NORMAL';
  breakoutTriggerLevel: { high: number; low: number };
  breakoutBias: 'WAITING_FOR_BOS' | 'BOS_UP' | 'BOS_DOWN';
  recommendationAr: string;
}

// 4. Wick Filter & Dynamic Stop Loss (10-bar max wick + 1.5 ATR)
export interface WickFilterMetrics {
  maxWick10Bars: number;
  currentAtr: number;
  calculatedWickBuffer: number; // maxWick + 1.5 * ATR
  rawStopDistance: number;
  dynamicStopLoss: number;
  riskRewardNumeric: number;
  isRRValid: boolean; // Must be >= 1:2.0
  verdict: 'APPROVED' | 'REJECTED_WIDE_STOP' | 'WARNING_HIGH_WICKS';
  explanationAr: string;
}

export interface SMCConfig {
  bullishThreshold: number;
  bearishThreshold: number;
  bslOffset: number;
  sslOffset: number;
  resistanceOffset: number;
  supportOffset: number;
  tpOffsetBuy: number;
  slOffsetBuy: number;
  tpOffsetSell: number;
  slOffsetSell: number;
}

export type MarketBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type TradeAction = 'BUY' | 'SELL' | 'WAIT';
export type MarketStructure = 'Uptrend (Bullish)' | 'Downtrend (Bearish)' | 'Consolidation (Range-bound)';

export interface FairValueGap {
  id: string;
  type: 'BISI' | 'SIBI'; // BISI = Bullish FVG, SIBI = Bearish FVG
  top: number;
  bottom: number;
  ce: number; // Consequent Encroachment (50% midpoint)
  timeframe: string;
  status: 'Fresh' | 'Partially Filled' | 'Mitigated';
  fillPercentage: number;
  isMarketMemory?: boolean; // Memory Index layer
}

export interface OrderBlockDetail {
  id: string;
  type: 'BULLISH_DEMAND' | 'BEARISH_SUPPLY';
  min: number;
  max: number;
  equilibrium: number;
  timeframe: string;
  volume: string;
  mitigationStatus: 'Unmitigated' | 'Tested' | 'Breached';
  confluenceScore: number;
  barsAge: number; // Age in candles
  freshnessScore: number; // 0% (20+ bars) to 100% (5 or fewer bars)
  isMarketMemory?: boolean; // Memory Index layer
}

// 5. Proximity Scanner & Real-Time Alerts
export interface ProximityAlert {
  id: string;
  timestamp: string;
  levelName: string;
  targetPrice: number;
  distanceToPrice: number;
  status: 'EARLY_WARNING' | 'CONFLUENCE_READY' | 'TRIGGERED';
  messageAr: string;
}

// 6. Post-Trade Memory & Performance Journal
export interface PostTradeRecord {
  id: string;
  date: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnlDollar: number;
  result: 'WIN' | 'LOSS' | 'SCRATCH';
  obRespected: boolean;
  hadSweepBefore: boolean;
  obFreshness: number; // 0 - 100%
  durationMinutes: number;
  lessonLearnedAr: string;
}

export interface SMCScenario {
  id: string;
  titleAr: string;
  type: 'BULLISH_EXPANSION' | 'BEARISH_BREAKDOWN' | 'RANGE_ACCUMULATION';
  probability: number;
  triggerConditionAr: string;
  entryRange: { min: number; max: number };
  invalidationLevel: number;
  targetTakeProfits: number[];
  riskReward: string;
  rationaleAr: string;
}

export interface EconomicNewsItem {
  id: string;
  titleAr: string;
  source: string;
  time: string;
  category: 'INFLATION' | 'INTEREST_RATE' | 'EMPLOYMENT' | 'GEOPOLITICAL' | 'CENTRAL_BANK';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  actual?: string;
  forecast?: string;
  previous?: string;
  goldImpactAr: string;
  directionalBias: 'BULLISH' | 'BEARISH' | 'VOLATILITY';
}

export interface ScenarioProjection {
  timeframe: '15M' | '1H' | '4H' | '1D';
  currentPrice: number;
  projectedPrice: number;
  projectedChangePct: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  atrUsed: number | null;
  rangeUpper: number;
  rangeLower: number;
  horizonMinutes: number;
  projectionMethod: 'ATR_SCALED_DRIFT';
  disclaimer: string;
  notesAr: string;
}

export interface SMCAnalysis {
  currentPrice: number;
  bias: MarketBias;
  action: TradeAction;
  structure: MarketStructure;
  bsl: number; // Buy-Side Liquidity
  ssl: number; // Sell-Side Liquidity
  resistance: number;
  support: number;
  bullishOB: { 
    min: number; 
    max: number; 
    barsAge?: number; 
    freshnessScore?: number; 
    mitigationStatus?: 'Unmitigated' | 'Tested' | 'Breached';
  };
  bearishOB: { 
    min: number; 
    max: number; 
    barsAge?: number; 
    freshnessScore?: number; 
    mitigationStatus?: 'Unmitigated' | 'Tested' | 'Breached';
  };
  fvgs: FairValueGap[];
  orderBlocks: OrderBlockDetail[];
  entryZone: { min: number; max: number };
  takeProfit: number;
  stopLoss: number;
  riskRewardRatio: string;
  rrNumeric: number;
  reason: string;
  timestamp: string;
  confluenceScore: number; // 0 - 100%
  // Advanced features:
  wickFilter?: WickFilterMetrics;
  compression?: CompressionMetrics;
  postNewsSweep?: PostNewsSweepData;
  orderFlowVolume?: OrderFlowVolumeData;
  memoryIndexOBs?: OrderBlockDetail[];
  pointsPips?: PointsPipsDistance;
  mt5Synchronization?: {
    bid: number;
    ask: number;
    mid: number;
    spreadPoints: number;
    spreadPips: number;
    spreadOffset: number;
    spreadOffsetFormatted: string;
    brokerServer: string;
    symbol: string;
    pointsPipsSummary?: string;
  };
  /** Optional: real engine result (from RealSMCEngine). */
  realEngine?: {
    asOfIndex: number;
    asOfTime: number;
    atrCurrent: number | null;
    regime: Regime;
    confluenceScore: number;
    confluenceEligible: boolean;
    reasonCodes: string[];
    swingCount: number;
    breakCount: number;
    fvgCount: number;
    obCount: number;
    levelCount: number;
    sweepCount: number;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  step: 'Data Collection' | 'Market Analysis' | 'Report Generation' | 'Delivery' | 'جمع البيانات' | 'التحليل الهيكلي' | 'توليد التوصية' | 'البث لتيليجرام' | string;
  status: 'pending' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export interface RepoFile {
  path: string;
  filename: string;
  category: 'workflow' | 'core' | 'modular' | 'docs';
  description: string;
  language: 'python' | 'yaml' | 'markdown' | 'text' | 'env';
  content: string;
}

// =========================================================================
// Price & Volume Data Engine Interfaces (Institutional Architecture)
// =========================================================================
export type ExchangeSource = 'BINANCE' | 'BYBIT' | 'OKX' | 'MT5_DEMO';

export interface ExchangeStatus {
  name: ExchangeSource;
  labelAr: string;
  status: 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'STANDBY';
  latencyMs: number;
  lastPrice: number;
  lastUpdated: string;
  tradeCount: number;
  errorCount: number;
}

export interface TradeRecord {
  price: number;
  qty: number;
  side: 'BUY' | 'SELL';
  timestamp: number;
  source: ExchangeSource;
}

export interface RealtimeCVDMetrics {
  cumulativeDelta: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  tickCountTotal: number;
  ticksLastMinute: number;
  ticksLast5Sec: number;
  tickVelocity: number;
  orderFlowSpeed: 'VERY_HIGH_MOMENTUM' | 'HIGH_MOMENTUM' | 'MODERATE_FLOW' | 'LOW_FLOW';
  orderFlowSpeedAr: string;
  recentTrades: TradeRecord[];
}

export interface RollingBasisCalibration {
  mgcPrice: number;
  binancePrice: number;
  rollingBasisRatio: number;
  syncedPrice: number;
  divergencePct: number;
  cautionMode: boolean;
  positionSizeMultiplier: number;
  sampleCount: number;
  statusMessageAr: string;
  lastCalibrated: string;
}

export interface VolumeProfileBin {
  price: number;
  volume: number;
  isPoC: boolean;
  inValueArea: boolean;
}

export interface LiquidityGap {
  zone: 'ABOVE_POC' | 'BELOW_POC';
  fromPrice: number;
  toPrice: number;
  type: 'LOW_VOLUME_NODE_IMBALANCE';
  noteAr: string;
}

export interface ValueAreaMetrics {
  mgcRawVolume: number;
  gcCalibratedVolume: number;
  anchoredVWAP: number;
  pocPrice: number;
  pocVolume: number;
  vahPrice: number;
  valPrice: number;
  volumeProfile: VolumeProfileBin[];
  earlyLiquidityGaps: LiquidityGap[];
  lastCalculated: string;
}

export interface EngineFailoverEvent {
  id: string;
  timestamp: string;
  from: ExchangeSource;
  to: ExchangeSource;
  reasonAr: string;
}

export interface PriceVolumeEngineState {
  activePrimarySource: ExchangeSource;
  medianPrice: number;
  syncedPrice: number;
  binancePrice: number;
  mgcPrice: number;
  basisSpread: number;
  exchanges: Record<ExchangeSource, ExchangeStatus>;
  cvd: RealtimeCVDMetrics;
  calibration: RollingBasisCalibration;
  volumeValueEngine: ValueAreaMetrics;
  failoverEvents: EngineFailoverEvent[];
}

export interface MT5AccountConfig {
  accountNumber: string;
  brokerServer: string;
  symbol: string;
  pointValue: number;
  digits: number;
  contractSize: number;
  leverage: number;
}

export interface PointsPipsDistance {
  slPips: number;
  slPoints: number;
  tpPips: number;
  tpPoints: number;
  atrPips: number;
  atrPoints: number;
  riskRewardRatio: number;
  summaryAr: string;
}

export interface MT5SyncState {
  isConnected: boolean;
  symbol: string;
  bid: number;
  ask: number;
  midPrice: number;
  spreadPoints: number;
  spreadPips: number;
  pointValue: number;
  digits: number;
  sourceMode: 'MT5_PYTHON_TERMINAL' | 'MT5_BRIDGE_DEMO' | 'MANUAL_BROKER_FEED';
  accountConfig: MT5AccountConfig;
  lastSyncTimestamp: string;
  externalReferencePrice: number;
  spreadOffset: number;
  spreadOffsetFormatted: string;
  statusMessageAr: string;
}

export type ChartTimeframe = '4H' | '1D' | '1W' | '1M';

export interface CandleData {
  time: number; // Unix timestamp in seconds
  dateStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  isBullish: boolean;
  timeframe: ChartTimeframe;
  bodyRatio: number;
  upperWick: number;
  lowerWick: number;
  patternAr: string;
}

export interface MultiTimeframeSummary {
  timeframe: ChartTimeframe;
  labelAr: string;
  candle: CandleData;
  trendAr: string;
  momentumScore: number;
  highLiquidityLevel: number; // BSL
  lowLiquidityLevel: number; // SSL
  statusAr: string;
}

export interface CandleResponseData {
  timeframe: ChartTimeframe;
  candles: CandleData[];
  latestCandle: CandleData;
  summary: MultiTimeframeSummary;
  allTimeframesSummary: Record<ChartTimeframe, MultiTimeframeSummary>;
  symbol: string;
  source: string;
  updatedAt: string;
}

// =========================================================================
// Multi-Timeframe SMC Engine (5-Tier Institutional Hierarchy)
// =========================================================================

// 1. Weekly HTF - Major Levels
export interface WeeklyMajorLevel {
  id: string;
  price: number;
  type: 'MAJOR_WEEKLY_RESISTANCE' | 'MAJOR_WEEKLY_SUPPORT' | 'HISTORICAL_EQUILIBRIUM';
  labelAr: string;
  reboundStrength: 'EXTREME_REJECTION' | 'STRONG_REJECTION' | 'MODERATE';
  touchCount: number;
  volumeSpikeLots: number;
  distanceUsd: number;
  distancePct: number;
  isBroken: boolean;
  referenceLineStyle: 'SOLID_HORIZONTAL_RED' | 'SOLID_HORIZONTAL_GREEN' | 'DASHED_GOLD';
  rationaleAr: string;
}

export interface WeeklyHTFState {
  timeframe: '1W';
  majorLevels: WeeklyMajorLevel[];
  htfTrend: MarketBias;
  htfTrendAr: string;
  keySupport: number;
  keyResistance: number;
  weeklyRangePct: number;
  institutionalNotesAr: string;
}

// 2. Daily HTF - Trend & Refinement
export interface DailyRefinedLevel {
  id: string;
  price: number;
  type: 'DAILY_SUPPORT' | 'DAILY_RESISTANCE' | 'DAILY_PIVOT_ZONE';
  colorCode: string; // Distinct accent color for daily
  labelAr: string;
  accuracyRefinementPips: number;
  parentWeeklyLevelId?: string;
  isFresh: boolean;
}

export interface DailyHTFState {
  timeframe: '1D';
  trend: MarketBias;
  trendLabelAr: string;
  marketStructure: 'BULLISH_EXPANSION_BOS' | 'BEARISH_EXPANSION_BOS' | 'CHOH_DEVELOPING' | 'INTERNAL_CONSOLIDATION';
  marketStructureLabelAr: string;
  swingHigh: number;
  swingLow: number;
  bosLevel: number;
  refinedLevels: DailyRefinedLevel[];
  refinementDeltaPips: number;
  structureNotesAr: string;
}

// 3. 4H ITF - Supply/Demand & Decision
export interface Zone4H {
  min: number;
  max: number;
  equilibrium: number;
  volumeScore: number;
  freshnessPct: number;
  labelAr: string;
  status: 'UNMITIGATED' | 'TESTED' | 'BREACHED';
}

export interface H4DecisionState {
  timeframe: '4H';
  supplyZone: Zone4H;
  demandZone: Zone4H;
  bullishOrderBlock: OrderBlockDetail;
  bearishOrderBlock: OrderBlockDetail;
  bslPrice: number; // Buy-Side Liquidity
  sslPrice: number; // Sell-Side Liquidity
  primaryDecision: 'STRONG_BUY' | 'STRONG_SELL' | 'WAIT_CONFIRMATION' | 'BUY_ON_DEMAND_DIP' | 'SELL_ON_SUPPLY_RALLY';
  primaryDecisionLabelAr: string;
  decisionAction: TradeAction;
  decisionRationaleAr: string;
  confluenceScore: number;
  suggestedRR: string;
  decisionValidity: 'VALID' | 'PENDING_TEST' | 'INVALIDATED';
}

// 4. 1H LTF - Liquidity Sweeps
export interface LiquiditySweep1H {
  id: string;
  titleAr: string;
  targetType: 'PREVIOUS_DAY_HIGH' | 'PREVIOUS_DAY_LOW' | 'ASIAN_SESSION_EXTREME' | 'EQUAL_HIGHS_EQH' | 'EQUAL_LOWS_EQL';
  targetPrice: number;
  sweepHighLow: number;
  reactionType: 'IMMEDIATE_REJECTION_WICK' | 'FAKE_BREAKOUT_TRAP' | 'RETURN_INSIDE_RANGE';
  volumeDeltaSpike: number;
  preZoneTestStatus: 'SWEEP_BEFORE_4H_DEMAND' | 'SWEEP_BEFORE_4H_SUPPLY' | 'PENDING_APPROACH';
  isMarketMakerTrap: boolean;
  statusAr: string;
  timestamp: string;
}

export interface H1LiquiditySweepsState {
  timeframe: '1H';
  activeSweeps: LiquiditySweep1H[];
  sweepCountLast24h: number;
  lastSweepReactionAr: string;
  isApproaching4HZone: boolean;
  targetZoneType: '4H_DEMAND' | '4H_SUPPLY' | 'NONE';
  sweepVerdictAr: string;
}

// 5. 15M Entry Frame - Execution Signals
export interface M15ExecutionState {
  timeframe: '15M';
  executionStatus: 'ACTIVE_TRIGGER' | 'WAITING_CHOH' | 'CONFIRMED_SNIPER_ENTRY';
  chohDetected: boolean;
  chohType: 'BULLISH_CHOH_M15' | 'BEARISH_CHOH_M15' | 'NONE';
  chohLevel: number;
  reversalPattern: 'CHOH_PLUS_FVG_RETEST' | 'ENGULFING_LIQUIDITY_GRAB' | 'DISPLACEMENT_CANDLE' | 'NONE';
  reversalPatternLabelAr: string;
  sniperEntryPrice: number;
  surgicalStopLoss: number;
  surgicalTakeProfit1: number;
  surgicalTakeProfit2: number;
  surgicalTakeProfit3: number;
  stopLossDistancePips: number;
  takeProfit1Pips: number;
  takeProfit2Pips: number;
  riskRewardRatio: string;
  rrNumeric: number;
  isRRValid: boolean; // >= 1:2.0 rule
  executionRuleVerdictAr: string;
  confirmationCandleTime: string;
}

// Unified Multi-Timeframe Engine Model
export interface MultiTimeframeSMCEngineState {
  currentPrice: number;
  timestamp: string;
  alignmentScore: number; // 0% - 100% confluence
  cascadeState: 'FULL_CONFLUENCE_ALIGNED' | '4H_15M_ALIGNED' | 'CONFLICTING_HTF_LTF' | 'WAITING_SWEEP';
  cascadeSummaryAr: string;
  weeklyHTF: WeeklyHTFState;
  dailyHTF: DailyHTFState;
  h4Decision: H4DecisionState;
  h1Sweeps: H1LiquiditySweepsState;
  m15Execution: M15ExecutionState;
}

