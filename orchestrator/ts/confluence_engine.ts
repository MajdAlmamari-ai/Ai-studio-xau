// orchestrator/ts/confluence_engine.ts
import pino from 'pino';
import { getRedis } from '../../spot_engine/ts/shared/redis_client';
import { 
  type StructureSignal, 
  type KeyLevel, 
  type ExecutionDecision, 
  type TradePlan,
  type AccountState 
} from '../../shared/types';
import { calculatePositionSize } from '../../spot_engine/ts/core/risk_engine';

const logger = pino({ name: 'ConfluenceEngine' });

export interface ConfluenceEvaluation {
  decision: ExecutionDecision;
  reasons: string[];
}

export class ConfluenceEngine {
  private cachedLevels: KeyLevel[] = [];
  private lastLevelsFetch = 0;

  async loadLatestLevels(): Promise<KeyLevel[]> {
    if (Date.now() - this.lastLevelsFetch < 10000 && this.cachedLevels.length > 0) {
      return this.cachedLevels;
    }

    try {
      const redis = getRedis();
      const raw = await redis.get('futures:levels:latest');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.levels)) {
          this.cachedLevels = parsed.levels;
          this.lastLevelsFetch = Date.now();
          return this.cachedLevels;
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message || err }, 'Failed to fetch futures levels from Redis, using fallback memory');
    }
    return this.cachedLevels;
  }

  evaluateSignal(
    signal: StructureSignal,
    levels: KeyLevel[],
    account: AccountState,
    currentSpread = 0.3
  ): ConfluenceEvaluation {
    const notes: string[] = [];
    const entry = signal.entry;
    let confidence = signal.baseConfidence || 0.7;

    // 1. Toxic Spread Gate
    if (currentSpread > 0.8) {
      return {
        decision: {
          action: 'REJECT',
          reason: `TOXIC_SPREAD: ${currentSpread.toFixed(2)} > 0.80`,
          confidence: 0,
          notes: ['Spread exceeds institutional threshold'],
        },
        reasons: ['TOXIC_SPREAD'],
      };
    }

    // 2. Hard Confluence: Check against Institutional Resistance/Support
    const BUFFER = 2.0; // $2 buffer on Gold

    for (const lvl of levels) {
      // Long into Fresh Institutional Resistance
      if (signal.dir === 'LONG' && lvl.type === 'RESISTANCE' && lvl.strength === 'INSTITUTIONAL' && lvl.is_fresh) {
        if (entry >= lvl.zone_low - BUFFER && entry <= lvl.zone_high + 0.5) {
          notes.push(`REJECT: Buying directly into Fresh Institutional Resistance at $${lvl.price.toFixed(2)}`);
          return {
            decision: { action: 'REJECT', reason: 'BUY_INTO_INSTITUTIONAL_RESISTANCE', confidence: 0, notes },
            reasons: notes,
          };
        }
      }

      // Short into Fresh Institutional Support
      if (signal.dir === 'SHORT' && lvl.type === 'SUPPORT' && lvl.strength === 'INSTITUTIONAL' && lvl.is_fresh) {
        if (entry <= lvl.zone_high + BUFFER && entry >= lvl.zone_low - 0.5) {
          notes.push(`REJECT: Selling directly into Fresh Institutional Support at $${lvl.price.toFixed(2)}`);
          return {
            decision: { action: 'REJECT', reason: 'SELL_INTO_INSTITUTIONAL_SUPPORT', confidence: 0, notes },
            reasons: notes,
          };
        }
      }

      // In the middle of an active unmitigated Pivot Zone
      if (lvl.type === 'PIVOT_ZONE' && entry >= lvl.zone_low && entry <= lvl.zone_high && !lvl.is_fresh) {
        notes.push(`WAIT: Price trapped inside choppy Pivot Zone [$${lvl.zone_low.toFixed(2)} - $${lvl.zone_high.toFixed(2)}]`);
        return {
          decision: { action: 'WAIT', reason: 'INSIDE_PIVOT_ZONE', confidence: 0.3, notes },
          reasons: notes,
        };
      }

      // Confluence BOOST: Buying off Fresh Support
      if (signal.dir === 'LONG' && lvl.type === 'SUPPORT' && Math.abs(entry - lvl.price) <= BUFFER) {
        confidence = Math.min(1.0, confidence + 0.2);
        notes.push(`BOOST: Long aligned with ${lvl.strength} Support at $${lvl.price.toFixed(2)}`);
      }

      // Confluence BOOST: Selling off Fresh Resistance
      if (signal.dir === 'SHORT' && lvl.type === 'RESISTANCE' && Math.abs(entry - lvl.price) <= BUFFER) {
        confidence = Math.min(1.0, confidence + 0.2);
        notes.push(`BOOST: Short aligned with ${lvl.strength} Resistance at $${lvl.price.toFixed(2)}`);
      }
    }

    // 3. Sizing via Risk Engine
    const sizing = calculatePositionSize(signal, account, currentSpread);
    if (!sizing.validation.ok) {
      return {
        decision: {
          action: 'REJECT',
          reason: `RISK_VALIDATION_FAILED: ${sizing.validation.errors.join('; ')}`,
          confidence: 0,
          notes: sizing.validation.errors,
        },
        reasons: sizing.validation.errors,
      };
    }

    const plan: TradePlan = {
      id: signal.id,
      dir: signal.dir,
      lot_size: sizing.lotSize,
      entry: signal.entry,
      entryType: 'LIMIT',
      sl: signal.sl,
      tps: signal.tps,
      risk_usd: sizing.riskUsd,
      rr: Math.abs(signal.tps[0] - signal.entry) / Math.max(0.1, Math.abs(signal.entry - signal.sl)),
      margin_req: sizing.marginReq,
      toxicity_estimate: 0.1,
      validation: { ok: true, errors: [] },
    };

    return {
      decision: {
        action: 'EXECUTE',
        confidence,
        plan,
        notes,
      },
      reasons: notes,
    };
  }
}
