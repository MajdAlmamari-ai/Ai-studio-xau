// spot_engine/ts/core/risk_engine.ts
import { 
  TradePlanSchema, 
  type AccountState, 
  type TradePlan, 
  type StructureSignal 
} from '../../../shared/types';
import pino from 'pino';

const logger = pino({ name: 'RiskEngine' });

const CONTRACT_SIZE = 100.0;
const TICK_VALUE = 1.0; // $ per 0.01 per Lot
const MAX_MARGIN_UTIL = 0.5; // 50% Free Margin Buffer

export interface SizingResult {
  lotSize: number;
  riskUsd: number;
  slDistPips: number;
  marginReq: number;
  validation: { ok: boolean; errors: string[] };
}

export function calculatePositionSize(
  signal: StructureSignal, 
  account: AccountState, 
  currentSpread: number
): SizingResult {
  const errors: string[] = [];
  const dir = signal.dir;
  const entry = signal.entry;
  const sl = signal.sl;

  // 1. Distance Validation
  const slDist = Math.abs(entry - sl);
  if (slDist <= 0) errors.push('SL Distance Zero');
  const slDistPips = slDist / 0.01;

  // 2. Spread Cost (Pips)
  const spreadPips = currentSpread / 0.01;

  // 3. Risk Per Lot (USD)
  const riskPerLot = (slDistPips + spreadPips) * TICK_VALUE;

  // 4. Account Equity Risk Limit
  const maxRiskUsd = account.equity * 0.01; // 1% Hardcoded Risk Policy
  if (riskPerLot <= 0) errors.push('Risk Per Lot Zero');

  let lotSize = riskPerLot > 0 ? maxRiskUsd / riskPerLot : 0;
  
  // 5. Rounding (Broker Step 0.01)
  lotSize = Math.max(0.01, Math.floor(lotSize / 0.01) * 0.01);

  // 6. Margin Physics Check
  const marginReq = (lotSize * CONTRACT_SIZE * entry) / account.leverage;
  
  if (marginReq > account.free_margin * MAX_MARGIN_UTIL) {
    errors.push(`Margin Limit: Req ${marginReq.toFixed(2)} > Avail ${(account.free_margin * MAX_MARGIN_UTIL).toFixed(2)}`);
    // Auto-Reduce
    const maxLots = (account.free_margin * MAX_MARGIN_UTIL * account.leverage) / (CONTRACT_SIZE * entry);
    lotSize = Math.max(0.01, Math.floor(maxLots / 0.01) * 0.01);
  }

  // 7. Stop Out Guard
  const maxLoss = lotSize * riskPerLot;
  const equityAfterSL = account.equity - maxLoss;
  const marginLevelAfter = (equityAfterSL / Math.max(1, marginReq)) * 100;
  if (marginLevelAfter < account.stop_out_pct * 100) {
    errors.push(`Stop Out Risk: Margin Level ${marginLevelAfter.toFixed(1)}% < ${account.stop_out_pct * 100}%`);
  }

  const riskUsd = lotSize * riskPerLot;
  const rr = slDist > 0 ? Math.abs(signal.tps[0] - entry) / slDist : 0;

  const plan: TradePlan = {
    dir,
    lot_size: lotSize,
    entry,
    sl,
    tps: signal.tps,
    risk_usd: riskUsd,
    rr,
    margin_req: marginReq,
    toxicity_estimate: 0.1,
    validation: { ok: errors.length === 0, errors },
  };

  const parsed = TradePlanSchema.safeParse(plan);
  if (!parsed.success) {
    errors.push('Plan Schema Invalid');
    logger.warn({ issues: parsed.error.issues }, 'TradePlan validation failed');
  }

  return { lotSize, riskUsd, slDistPips, marginReq, validation: { ok: errors.length === 0, errors } };
}
