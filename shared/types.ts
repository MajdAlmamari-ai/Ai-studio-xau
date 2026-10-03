import { z } from 'zod';

/**
 * ============================================================================
 * GOLD DESK QUANT SYSTEM — SHARED TYPES CONTRACT (SOURCE OF TRUTH)
 * TypeScript / Zod Schemas — Enforced 1:1 Parity with Python Pydantic v2
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. Spot Tick Schema (Raw Market Microstructure)
// ----------------------------------------------------------------------------
export const SpotTickSchema = z.object({
  bid: z.number().positive().describe('Best Bid Price'),
  ask: z.number().positive().describe('Best Ask Price'),
  ts_ms: z.number().int().positive().describe('Epoch millisecond timestamp'),
  vol: z.number().nonnegative().default(1.0).describe('Tick volume or lot size'),
});
export type SpotTick = z.infer<typeof SpotTickSchema>;

// ----------------------------------------------------------------------------
// 2. Spot 1M Bar Schema (Microstructure-Aware Closed Bars)
// ----------------------------------------------------------------------------
export const SpotBarSchema = z.object({
  ts: z.number().int().positive().describe('Bucket Start Unix Timestamp in seconds'),
  ts_ms: z.number().int().positive().describe('Bucket Start Epoch Milliseconds'),
  
  // Explicit Bid OHLC
  bid_o: z.number().positive(),
  bid_h: z.number().positive(),
  bid_l: z.number().positive(),
  bid_c: z.number().positive(),
  
  // Explicit Ask OHLC
  ask_o: z.number().positive(),
  ask_h: z.number().positive(),
  ask_l: z.number().positive(),
  ask_c: z.number().positive(),
  
  // Explicit Mid OHLC
  mid_o: z.number().positive(),
  mid_h: z.number().positive(),
  mid_l: z.number().positive(),
  mid_c: z.number().positive(),
  
  // Microstructure Spread Distributions
  spread_avg: z.number().nonnegative().describe('Average spread in pips/cents'),
  spread_max: z.number().nonnegative().describe('Maximum observed spread spike'),
  spread_p90: z.number().nonnegative().describe('90th percentile spread in bar'),
  
  // Intra-bar Sequencing (Prevents Green/Red Bar Lookahead Bias)
  high_ts_offset_ms: z.number().int().nonnegative().describe('Offset in ms from bar start to High'),
  low_ts_offset_ms: z.number().int().nonnegative().describe('Offset in ms from bar start to Low'),
  
  tick_count: z.number().int().positive().describe('Total tick volume within the closed bar'),
});
export type SpotBar = z.infer<typeof SpotBarSchema>;

// ----------------------------------------------------------------------------
// 3. Futures GC1! Key Level Schema (Pure Price Compass)
// ----------------------------------------------------------------------------
export const LevelTypeEnum = z.enum([
  'SUPPORT',
  'RESISTANCE',
  'PIVOT_ZONE',
  'PSYCHOLOGICAL_MAGNET',
  'SESSION_HIGH_LOW',
]);
export type LevelType = z.infer<typeof LevelTypeEnum>;

export const LevelStrengthEnum = z.enum([
  'INSTITUTIONAL',
  'MAJOR',
  'INTERMEDIATE',
  'WEAK',
]);
export type LevelStrength = z.infer<typeof LevelStrengthEnum>;

export const LiquidityTypeEnum = z.enum([
  'SWING_CLUSTER',
  'PSYCHOLOGICAL',
  'OPTION_MAGNET',
  'SESSION_HIGH_LOW',
  'DAILY_OPEN',
]);
export type LiquidityType = z.infer<typeof LiquidityTypeEnum>;

export const KeyLevelSchema = z.object({
  id: z.string().describe('Unique deterministic hash of level'),
  price: z.number().positive().describe('Center price of level in USD'),
  zone_low: z.number().positive().describe('Lower bound of buffer zone'),
  zone_high: z.number().positive().describe('Upper bound of buffer zone'),
  type: LevelTypeEnum,
  strength: LevelStrengthEnum,
  score: z.number().min(0).max(100).describe('Composite institutional strength score 0-100'),
  touches: z.number().int().nonnegative().describe('Validated touch count'),
  last_touch_ts: z.number().int().positive().describe('Timestamp of most recent interaction'),
  tf_origin: z.enum(['1D', '4H', '1H', '15m']),
  confluence_count: z.number().int().min(1).max(4).describe('How many timeframes confirmed this zone'),
  is_fresh: z.boolean().describe('True if no closing candle has penetrated through the zone'),
  mitigation_pct: z.number().min(0).max(100).describe('Percentage of zone penetrated by wicks'),
  liquidity_type: LiquidityTypeEnum,
  ttl_ms: z.number().int().positive().describe('Total time to live in milliseconds'),
  expires_at: z.number().int().positive().describe('Epoch timestamp when level expires'),
});
export type KeyLevel = z.infer<typeof KeyLevelSchema>;

// ----------------------------------------------------------------------------
// 4. Structure Signal Schema (Pure SMC from Spot Microstructure)
// ----------------------------------------------------------------------------
export const StructureSignalSchema = z.object({
  id: z.string(),
  dir: z.enum(['LONG', 'SHORT']),
  entry: z.number().positive(),
  sl: z.number().positive(),
  tps: z.array(z.number().positive()).min(1),
  baseConfidence: z.number().min(0).max(1),
  created_at: z.number().int().positive(),
  expires_at: z.number().int().positive(),
  half_life_ms: z.number().int().positive(),
  source_structure: z.enum(['OB', 'FVG', 'BOS_PULLBACK', 'SSL_SWEEP', 'BSL_SWEEP']),
});
export type StructureSignal = z.infer<typeof StructureSignalSchema>;

// ----------------------------------------------------------------------------
// 5. Account State Schema (Margin Physics & Risk Guard)
// ----------------------------------------------------------------------------
export const AccountStateSchema = z.object({
  equity: z.number().positive(),
  balance: z.number().positive(),
  free_margin: z.number().nonnegative(),
  used_margin: z.number().nonnegative(),
  leverage: z.number().positive().default(20.0),
  stop_out_pct: z.number().positive().default(20.0),
  currency: z.literal('USD').default('USD'),
  liveSpread: z.number().nonnegative(),
  spreadAvg1h: z.number().nonnegative(),
});
export type AccountState = z.infer<typeof AccountStateSchema>;

// ----------------------------------------------------------------------------
// 6. Trade Plan Schema (Sized Execution Object)
// ----------------------------------------------------------------------------
export const TradePlanValidationSchema = z.object({
  ok: z.boolean(),
  errors: z.array(z.string()),
});

export const TradePlanSchema = z.object({
  id: z.string().optional(),
  dir: z.enum(['LONG', 'SHORT']),
  lot_size: z.number().positive(),
  entry: z.number().positive(),
  entryType: z.enum(['MARKET', 'LIMIT', 'STOP']).optional(),
  sl: z.number().positive(),
  tps: z.array(z.number().positive()).min(1),
  risk_usd: z.number().positive(),
  rr: z.number().positive(),
  margin_req: z.number().positive(),
  toxicity_estimate: z.number().min(0).max(1).default(0.1),
  validation: TradePlanValidationSchema,
});
export type TradePlan = z.infer<typeof TradePlanSchema>;

// ----------------------------------------------------------------------------
// 7. Orchestrator Execution Decision Schema
// ----------------------------------------------------------------------------
export const ExecutionDecisionSchema = z.object({
  action: z.enum(['EXECUTE', 'WAIT', 'REJECT']),
  reason: z.string().optional(),
  plan: TradePlanSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.array(z.string()).default([]),
});
export type ExecutionDecision = z.infer<typeof ExecutionDecisionSchema>;
