/**
 * Trade Journal Recorder
 *
 * In-memory recorder for trade journal entries.
 * Persistence is handled separately.
 *
 * Deterministic. NO Math.random.
 * Rule: If sampleCount < 30, rate-based metrics = null.
 */

import { JournalSummary, TradeJournalEntry } from './types';

export class JournalRecorder {
  private entries: TradeJournalEntry[] = [];

  record(entry: TradeJournalEntry): void {
    this.entries.push(entry);
  }

  getAll(): ReadonlyArray<TradeJournalEntry> {
    return [...this.entries];
  }

  count(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }

  summarize(): JournalSummary {
    const n = this.entries.length;

    const byRegime: Record<string, number> = {};
    const byNewsStatus: Record<string, number> = {};
    const bySession: Record<string, number> = {};
    const byZoneType: Record<string, number> = {};

    for (const e of this.entries) {
      const reg = e.regimeAtEntry ?? 'UNKNOWN';
      byRegime[reg] = (byRegime[reg] ?? 0) + 1;
      byNewsStatus[e.newsStatusAtEntry] = (byNewsStatus[e.newsStatusAtEntry] ?? 0) + 1;
      bySession[e.sessionAtEntry ?? 'UNKNOWN'] = (bySession[e.sessionAtEntry ?? 'UNKNOWN'] ?? 0) + 1;
      byZoneType[e.zoneType ?? 'NONE'] = (byZoneType[e.zoneType ?? 'NONE'] ?? 0) + 1;
    }

    if (n < 30) {
      return {
        sampleCount: n,
        winRate: null,
        expectancyR: null,
        profitFactor: null,
        maxDrawdownPct: null,
        averageR: null,
        medianR: null,
        byRegime,
        byNewsStatus,
        bySession,
        byZoneType,
      };
    }

    const completed = this.entries.filter(
      (e) => e.realizedR !== null && e.exitTime !== null,
    );
    const winners = completed.filter((e) => (e.realizedR ?? 0) > 0);
    const losers = completed.filter((e) => (e.realizedR ?? 0) < 0);

    const winRate = completed.length > 0 ? winners.length / completed.length : null;

    const rValues = completed.map((e) => e.realizedR ?? 0);
    const averageR = rValues.length > 0
      ? rValues.reduce((a, b) => a + b, 0) / rValues.length
      : null;

    const sortedR = [...rValues].sort((a, b) => a - b);
    const medianR = sortedR.length > 0
      ? sortedR[Math.floor(sortedR.length / 2)]
      : null;

    const grossProfit = winners.reduce((a, e) => a + (e.realizedR ?? 0), 0);
    const grossLoss = Math.abs(losers.reduce((a, e) => a + (e.realizedR ?? 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

    let cumulative = 0;
    let peak = 0;
    let maxDdR = 0;
    for (const r of rValues) {
      cumulative += r;
      if (cumulative > peak) peak = cumulative;
      const dd = peak - cumulative;
      if (dd > maxDdR) maxDdR = dd;
    }
    const maxDrawdownPct = peak > 0 ? (maxDdR / peak) * 100 : null;

    return {
      sampleCount: n,
      winRate,
      expectancyR: averageR,
      profitFactor,
      maxDrawdownPct,
      averageR,
      medianR,
      byRegime,
      byNewsStatus,
      bySession,
      byZoneType,
    };
  }
}
