/**
 * Data Scheduler
 * 
 * Central scheduler for all data requests.
 * 
 * Responsibilities:
 *   - Rate each source appropriately.
 *   - Skip off-hours.
 *   - Avoid redundant requests (cache).
 *   - Adapt to sessions.
 * 
 * NOT responsibilities:
 *   - Executing trades (forbidden).
 *   - Auto-sending alerts.
 * 
 * Deterministic logic. NO Math.random.
 */

export type SessionName = 'ASIA' | 'LONDON' | 'NEW_YORK' | 'OVERLAP' | 'OFF_HOURS' | 'WEEKEND';

export interface SourceSchedule {
  readonly sourceId: string;
  readonly intervalMs: number;
  readonly skipOffHours: boolean;
  readonly skipWeekend: boolean;
  readonly lastFetchAt: number;
}

export interface SchedulerConfig {
  readonly spotXauUsd: number;        // Gold-API
  readonly futuresXauUsdt: number;    // Gate.io futures
  readonly candlesM15: number;        // Gate.io REST
  readonly candlesH1: number;
  readonly candlesH4: number;
  readonly candlesD1: number;
  readonly comexGcF: number;          // Yahoo
  readonly macro: number;             // FRED
  readonly cot: number;               // CFTC (weekly)
  readonly gvz: number;               // CBOE (daily)
}

export const DEFAULT_SCHEDULE: SchedulerConfig = {
  spotXauUsd: 5_000,          // 5 seconds
  futuresXauUsdt: 1_000,      // 1 second (WS-driven mostly)
  candlesM15: 60_000,         // 1 minute
  candlesH1: 15 * 60_000,     // 15 minutes
  candlesH4: 60 * 60_000,     // 1 hour
  candlesD1: 6 * 60 * 60_000, // 6 hours
  comexGcF: 15 * 60_000,      // 15 minutes (delayed anyway)
  macro: 24 * 60 * 60_000,    // 24 hours
  cot: 7 * 24 * 60 * 60_000,  // 7 days
  gvz: 24 * 60 * 60_000,      // 24 hours
};

export interface ScheduleEntry {
  readonly sourceId: string;
  readonly intervalMs: number;
  readonly lastFetchAt: number;
}

export class DataScheduler {
  private entries: Map<string, ScheduleEntry> = new Map();
  private config: SchedulerConfig;

  constructor(config: SchedulerConfig = DEFAULT_SCHEDULE) {
    this.config = config;
  }

  /**
   * Determine current session based on UTC time.
   */
  getCurrentSession(nowUtc: number): SessionName {
    const date = new Date(nowUtc);
    const day = date.getUTCDay(); // 0=Sunday, 6=Saturday
    const hour = date.getUTCHours();

    // Weekend
    if (day === 0 || day === 6) return 'WEEKEND';

    // Asia: 00:00 - 08:00 UTC
    if (hour >= 0 && hour < 8) return 'ASIA';

    // Overlap: 13:00 - 17:00 UTC
    if (hour >= 13 && hour < 17) return 'OVERLAP';

    // London: 08:00 - 17:00 UTC
    if (hour >= 8 && hour < 17) return 'LONDON';

    // NY: 17:00 - 22:00 UTC
    if (hour >= 17 && hour < 22) return 'NEW_YORK';

    // Off-hours: 22:00 - 00:00 UTC
    return 'OFF_HOURS';
  }

  /**
   * Check if a source should be fetched now.
   */
  shouldFetch(sourceId: string, nowUtc: number, session: SessionName): boolean {
    const entry = this.entries.get(sourceId);
    const interval = this.getInterval(sourceId);

    if (interval === null) return false;

    // First fetch
    if (!entry) return true;

    // Time elapsed check
    const elapsed = nowUtc - entry.lastFetchAt;
    if (elapsed < interval) return false;

    // Session-based suppression
    if (session === 'WEEKEND') {
      // Only COMEX is available on weekends (delayed)
      if (sourceId !== 'comexGcF' && sourceId !== 'macro') return false;
    }

    if (session === 'OFF_HOURS') {
      // Slow down during off-hours
      if (elapsed < interval * 4) return false;
    }

    return true;
  }

  /**
   * Record a successful fetch.
   */
  recordFetch(sourceId: string, nowUtc: number): void {
    this.entries.set(sourceId, {
      sourceId,
      intervalMs: this.getInterval(sourceId) ?? 60_000,
      lastFetchAt: nowUtc,
    });
  }

  /**
   * Get the interval for a source.
   */
  private getInterval(sourceId: string): number | null {
    const map: Record<string, number> = {
      spotXauUsd: this.config.spotXauUsd,
      futuresXauUsdt: this.config.futuresXauUsdt,
      candlesM15: this.config.candlesM15,
      candlesH1: this.config.candlesH1,
      candlesH4: this.config.candlesH4,
      candlesD1: this.config.candlesD1,
      comexGcF: this.config.comexGcF,
      macro: this.config.macro,
      cot: this.config.cot,
      gvz: this.config.gvz,
    };
    return map[sourceId] ?? null;
  }

  /**
   * List all sources that should be fetched now.
   */
  getDueSources(nowUtc: number): string[] {
    const session = this.getCurrentSession(nowUtc);
    const all = [
      'spotXauUsd',
      'futuresXauUsdt',
      'candlesM15',
      'candlesH1',
      'candlesH4',
      'candlesD1',
      'comexGcF',
      'macro',
      'cot',
      'gvz',
    ];
    return all.filter((s) => this.shouldFetch(s, nowUtc, session));
  }
}
