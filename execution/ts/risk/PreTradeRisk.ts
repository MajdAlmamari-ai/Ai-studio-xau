// execution/ts/risk/PreTradeRisk.ts
import pino from 'pino';
import { TradePlan, AccountState } from '../../../shared/types';
import { IBrokerAdapter } from '../interfaces/IBrokerAdapter';

const logger = pino({ name: 'PreTradeRisk' });

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  adjustedPlan?: TradePlan;
}

export class PreTradeRiskGuard {
  private adapter: IBrokerAdapter;
  private config = {
    maxSlippagePct: 0.0005,     // 5 pips max slippage vs signal price
    maxSpreadMultiplier: 1.5,   // Recheck at execution time
    maxPositionSizeLots: 50,    // Hard Cap
    maxDailyLossPct: 0.03,      // 3% Daily Loss Limit
    maxOpenOrders: 10,
  };

  constructor(adapter: IBrokerAdapter) {
    this.adapter = adapter;
  }

  async validate(plan: TradePlan, account: AccountState): Promise<RiskCheckResult> {
    // 1. Basic Sanity
    if (plan.lot_size > this.config.maxPositionSizeLots) {
      return { allowed: false, reason: `LOT_SIZE_EXCEEDS_MAX: ${plan.lot_size} > ${this.config.maxPositionSizeLots}` };
    }
    if (plan.lot_size < 0.01) return { allowed: false, reason: 'LOT_SIZE_TOO_SMALL' };

    // 2. Margin Check (Real-time from Broker)
    const snapshot = await this.adapter.getAccountSnapshot();
    const marginRequired = (plan.lot_size * 100 * plan.entry) / (account.leverage || 20);
    
    if (marginRequired > snapshot.freeMargin * 0.9) {
      return { allowed: false, reason: `INSUFFICIENT_MARGIN: Req ${marginRequired.toFixed(0)} > Free ${snapshot.freeMargin.toFixed(0)}` };
    }

    // 3. Spread/Slippage Re-check
    const avgSpread = account.spreadAvg1h || 0.3;
    if (snapshot.liveSpread > avgSpread * this.config.maxSpreadMultiplier) {
      return { allowed: false, reason: `SPREAD_WIDENED_AT_EXECUTION: ${snapshot.liveSpread} > ${this.config.maxSpreadMultiplier}x Avg` };
    }

    // 4. Daily Loss Limit (Circuit Breaker)
    const dailyPnl = snapshot.equity - snapshot.balance;
    if (dailyPnl < 0 && Math.abs(dailyPnl) > snapshot.balance * this.config.maxDailyLossPct) {
      return { allowed: false, reason: `DAILY_LOSS_LIMIT_HIT: ${((dailyPnl / snapshot.balance) * 100).toFixed(2)}%` };
    }

    // 5. Exposure Check
    const exposure = this.calculateExposure(snapshot.positions, plan.dir);
    if (exposure > 20) {
      return { allowed: false, reason: `EXPOSURE_LIMIT: Net ${exposure} Lots` };
    }

    return { allowed: true };
  }

  private calculateExposure(positions: any[], newDir: 'LONG' | 'SHORT'): number {
    let net = 0;
    for (const p of positions) {
      if (p.symbol && (p.symbol.includes('XAU') || p.symbol.includes('GOLD'))) {
        net += p.side === 'LONG' ? p.volume : -p.volume;
      }
    }
    return Math.abs(net + (newDir === 'LONG' ? 1 : -1));
  }
}
