from __future__ import annotations
from typing import Literal, List, Optional
from pydantic import BaseModel, Field

"""
============================================================================
GOLD DESK QUANT SYSTEM — SHARED TYPES CONTRACT (MIRROR TO TYPESCRIPT ZOD)
Pydantic v2 Models — Enforced 1:1 Parity with shared/types.ts
============================================================================
"""

# ----------------------------------------------------------------------------
# 1. Spot Tick Schema
# ----------------------------------------------------------------------------
class SpotTick(BaseModel):
    bid: float = Field(..., gt=0, description="Best Bid Price")
    ask: float = Field(..., gt=0, description="Best Ask Price")
    ts_ms: int = Field(..., gt=0, description="Epoch millisecond timestamp")
    vol: float = Field(default=1.0, ge=0, description="Tick volume or lot size")


# ----------------------------------------------------------------------------
# 2. Spot 1M Bar Schema (Microstructure-Aware Closed Bars)
# ----------------------------------------------------------------------------
class SpotBar(BaseModel):
    ts: int = Field(..., gt=0, description="Bucket Start Unix Timestamp in seconds")
    ts_ms: int = Field(..., gt=0, description="Bucket Start Epoch Milliseconds")
    
    # Explicit Bid OHLC
    bid_o: float = Field(..., gt=0)
    bid_h: float = Field(..., gt=0)
    bid_l: float = Field(..., gt=0)
    bid_c: float = Field(..., gt=0)
    
    # Explicit Ask OHLC
    ask_o: float = Field(..., gt=0)
    ask_h: float = Field(..., gt=0)
    ask_l: float = Field(..., gt=0)
    ask_c: float = Field(..., gt=0)
    
    # Explicit Mid OHLC
    mid_o: float = Field(..., gt=0)
    mid_h: float = Field(..., gt=0)
    mid_l: float = Field(..., gt=0)
    mid_c: float = Field(..., gt=0)
    
    # Microstructure Spread Distributions
    spread_avg: float = Field(..., ge=0, description="Average spread in pips/cents")
    spread_max: float = Field(..., ge=0, description="Maximum observed spread spike")
    spread_p90: float = Field(..., ge=0, description="90th percentile spread in bar")
    
    # Intra-bar Sequencing (Prevents Green/Red Bar Lookahead Bias)
    high_ts_offset_ms: int = Field(..., ge=0, description="Offset in ms from bar start to High")
    low_ts_offset_ms: int = Field(..., ge=0, description="Offset in ms from bar start to Low")
    
    tick_count: int = Field(..., gt=0, description="Total tick volume within the closed bar")


# ----------------------------------------------------------------------------
# 3. Futures GC1! Key Level Schema (Pure Price Compass)
# ----------------------------------------------------------------------------
LevelType = Literal[
    'SUPPORT',
    'RESISTANCE',
    'PIVOT_ZONE',
    'PSYCHOLOGICAL_MAGNET',
    'SESSION_HIGH_LOW',
]

LevelStrength = Literal[
    'INSTITUTIONAL',
    'MAJOR',
    'INTERMEDIATE',
    'WEAK',
]

LiquidityType = Literal[
    'SWING_CLUSTER',
    'PSYCHOLOGICAL',
    'OPTION_MAGNET',
    'SESSION_HIGH_LOW',
    'DAILY_OPEN',
]

class KeyLevel(BaseModel):
    id: str = Field(..., description="Unique deterministic hash of level")
    price: float = Field(..., gt=0, description="Center price of level in USD")
    zone_low: float = Field(..., gt=0, description="Lower bound of buffer zone")
    zone_high: float = Field(..., gt=0, description="Upper bound of buffer zone")
    type: LevelType
    strength: LevelStrength
    score: float = Field(..., ge=0, le=100, description="Composite institutional strength score 0-100")
    touches: int = Field(..., ge=0, description="Validated touch count")
    last_touch_ts: int = Field(..., gt=0, description="Timestamp of most recent interaction")
    tf_origin: Literal['1D', '4H', '1H', '15m']
    confluence_count: int = Field(..., ge=1, le=4, description="How many timeframes confirmed this zone")
    is_fresh: bool = Field(..., description="True if no closing candle has penetrated through the zone")
    mitigation_pct: float = Field(..., ge=0, le=100, description="Percentage of zone penetrated by wicks")
    liquidity_type: LiquidityType
    ttl_ms: int = Field(..., gt=0, description="Total time to live in milliseconds")
    expires_at: int = Field(..., gt=0, description="Epoch timestamp when level expires")


# ----------------------------------------------------------------------------
# 4. Structure Signal Schema
# ----------------------------------------------------------------------------
class StructureSignal(BaseModel):
    id: str
    dir: Literal['LONG', 'SHORT']
    entry: float = Field(..., gt=0)
    sl: float = Field(..., gt=0)
    tps: List[float] = Field(..., min_length=1)
    baseConfidence: float = Field(..., ge=0, le=1)
    created_at: int = Field(..., gt=0)
    expires_at: int = Field(..., gt=0)
    half_life_ms: int = Field(..., gt=0)
    source_structure: Literal['OB', 'FVG', 'BOS_PULLBACK', 'SSL_SWEEP', 'BSL_SWEEP']


# ----------------------------------------------------------------------------
# 5. Account State Schema
# ----------------------------------------------------------------------------
class AccountState(BaseModel):
    equity: float = Field(..., gt=0)
    balance: float = Field(..., gt=0)
    free_margin: float = Field(..., ge=0)
    used_margin: float = Field(..., ge=0)
    leverage: float = Field(default=20.0, gt=0)
    stop_out_pct: float = Field(default=20.0, gt=0)
    currency: Literal['USD'] = 'USD'
    liveSpread: float = Field(..., ge=0)
    spreadAvg1h: float = Field(..., ge=0)


# ----------------------------------------------------------------------------
# 6. Trade Plan Schema
# ----------------------------------------------------------------------------
class TradePlanValidation(BaseModel):
    ok: bool
    errors: List[str]

class TradePlan(BaseModel):
    id: Optional[str] = None
    dir: Literal['LONG', 'SHORT']
    lot_size: float = Field(..., gt=0)
    entry: float = Field(..., gt=0)
    entryType: Optional[Literal['MARKET', 'LIMIT', 'STOP']] = 'LIMIT'
    sl: float = Field(..., gt=0)
    tps: List[float] = Field(..., min_length=1)
    risk_usd: float = Field(..., gt=0)
    rr: float = Field(..., gt=0)
    margin_req: float = Field(..., gt=0)
    toxicity_estimate: float = Field(default=0.1, ge=0, le=1)
    validation: TradePlanValidation


# ----------------------------------------------------------------------------
# 7. Orchestrator Execution Decision Schema
# ----------------------------------------------------------------------------
class ExecutionDecision(BaseModel):
    action: Literal['EXECUTE', 'WAIT', 'REJECT']
    reason: Optional[str] = None
    plan: Optional[TradePlan] = None
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    notes: List[str] = Field(default_factory=list)
