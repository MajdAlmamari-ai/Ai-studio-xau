/**
 * Budget Tracker
 * 
 * Tracks usage per limited source.
 * Reserve 20% for emergencies.
 * Auto-reset on period boundary.
 * 
 * Deterministic. NO Math.random.
 */

export type BudgetPeriod = 'second' | 'minute' | 'hour' | 'day' | 'month';

export interface BudgetConfig {
  readonly sourceId: string;
  readonly limit: number;
  readonly period: BudgetPeriod;
  readonly reservePercent: number;
}

export interface BudgetStatus {
  readonly sourceId: string;
  readonly limit: number;
  readonly used: number;
  readonly remaining: number;
  readonly reserve: number;
  readonly available: number;
  readonly period: BudgetPeriod;
  readonly resetAt: number;
  readonly resetInMs: number;
  readonly exhausted: boolean;
}

export const DEFAULT_BUDGETS: readonly BudgetConfig[] = [
  // Gold-API: unlimited (no budget needed)
  { sourceId: 'gold-api', limit: Infinity, period: 'second', reservePercent: 0 },

  // Twelve Data: 800/day
  { sourceId: 'twelve-data', limit: 800, period: 'day', reservePercent: 0.2 },

  // Polygon: 5/min
  { sourceId: 'polygon', limit: 5, period: 'minute', reservePercent: 0.2 },

  // Yahoo: practical unlimited
  { sourceId: 'yahoo', limit: Infinity, period: 'second', reservePercent: 0 },

  // FRED: 120/hour
  { sourceId: 'fred', limit: 120, period: 'hour', reservePercent: 0.2 },

  // Gate.io REST: 300/10s → treat as ~1800/min
  { sourceId: 'gateio-rest', limit: 1800, period: 'minute', reservePercent: 0.2 },
];

function periodMs(period: BudgetPeriod): number {
  switch (period) {
    case 'second': return 1000;
    case 'minute': return 60_000;
    case 'hour': return 3600_000;
    case 'day': return 86_400_000;
    case 'month': return 30 * 86_400_000;
  }
}

export class BudgetTracker {
  private configs: Map<string, BudgetConfig> = new Map();
  private usage: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(configs: readonly BudgetConfig[] = DEFAULT_BUDGETS) {
    for (const cfg of configs) {
      this.configs.set(cfg.sourceId, cfg);
    }
  }

  /**
   * Compute the reset timestamp for a source's current period.
   */
  private computeResetAt(sourceId: string, nowUtc: number): number {
    const cfg = this.configs.get(sourceId);
    if (!cfg || !Number.isFinite(cfg.limit)) return Infinity;
    const period = periodMs(cfg.period);
    const periodStart = Math.floor(nowUtc / period) * period;
    return periodStart + period;
  }

  /**
   * Get current status for a source.
   */
  getStatus(sourceId: string, nowUtc: number): BudgetStatus {
    const cfg = this.configs.get(sourceId);
    if (!cfg) {
      return {
        sourceId,
        limit: 0,
        used: 0,
        remaining: 0,
        reserve: 0,
        available: 0,
        period: 'day',
        resetAt: Infinity,
        resetInMs: Infinity,
        exhausted: true,
      };
    }

    // Handle unlimited
    if (!Number.isFinite(cfg.limit)) {
      return {
        sourceId,
        limit: Infinity,
        used: this.usage.get(sourceId)?.count ?? 0,
        remaining: Infinity,
        reserve: 0,
        available: Infinity,
        period: cfg.period,
        resetAt: Infinity,
        resetInMs: Infinity,
        exhausted: false,
      };
    }

    // Get or reset usage
    const resetAt = this.computeResetAt(sourceId, nowUtc);
    let entry = this.usage.get(sourceId);

    if (!entry || nowUtc >= entry.resetAt) {
      entry = { count: 0, resetAt };
      this.usage.set(sourceId, entry);
    }

    const used = entry.count;
    const remaining = cfg.limit - used;
    const reserve = Math.floor(cfg.limit * cfg.reservePercent);
    const available = Math.max(0, remaining - reserve);

    return {
      sourceId,
      limit: cfg.limit,
      used,
      remaining,
      reserve,
      available,
      period: cfg.period,
      resetAt,
      resetInMs: resetAt - nowUtc,
      exhausted: available <= 0,
    };
  }

  /**
   * Check if a source can be used for a normal request.
   * (Does NOT count emergency reserve.)
   */
  canUse(sourceId: string, nowUtc: number): boolean {
    return !this.getStatus(sourceId, nowUtc).exhausted;
  }

  /**
   * Check if a source can be used for an emergency request.
   * (Includes reserve.)
   */
  canUseEmergency(sourceId: string, nowUtc: number): boolean {
    const status = this.getStatus(sourceId, nowUtc);
    return status.remaining > 0;
  }

  /**
   * Record a successful request.
   */
  record(sourceId: string, nowUtc: number, cost = 1): void {
    const cfg = this.configs.get(sourceId);
    if (!cfg || !Number.isFinite(cfg.limit)) return;

    const resetAt = this.computeResetAt(sourceId, nowUtc);
    let entry = this.usage.get(sourceId);

    if (!entry || nowUtc >= entry.resetAt) {
      entry = { count: 0, resetAt };
    }

    entry.count += cost;
    this.usage.set(sourceId, entry);
  }

  /**
   * List all sources with status.
   */
  listAll(nowUtc: number): BudgetStatus[] {
    return Array.from(this.configs.keys()).map((id) =>
      this.getStatus(id, nowUtc),
    );
  }
}
