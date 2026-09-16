import { describe, it, expect, beforeEach } from 'vitest';
import { JournalRecorder } from '../journal/recorder';
import { TradeJournalEntry } from '../journal/types';

function makeEntry(
  id: string,
  realizedR: number | null,
  exitTime: number | null = 1000,
  regime: 'TREND_UP' | 'TREND_DOWN' | 'RANGE' | null = 'TREND_UP',
): TradeJournalEntry {
  return {
    id,
    decisionId: `dec_${id}`,
    zoneId: `zone_${id}`,
    zoneType: 'OB',
    mitigationCountAtEntry: 0,
    direction: 'LONG',
    entryPrice: 2000,
    exitPrice: 2020,
    stopPrice: 1990,
    targetPrice: 2030,
    entryTime: 100,
    exitTime,
    exitReason: 'TARGET_HIT',
    realizedR,
    mae: -0.2,
    mfe: 2.1,
    newsStatusAtEntry: 'CALM',
    regimeAtEntry: regime,
    sessionAtEntry: 'LONDON',
    spreadAtEntry: 0.2,
    slippageAtEntry: 0.05,
    source: 'BACKTEST',
  };
}

describe('JournalRecorder', () => {
  let recorder: JournalRecorder;

  beforeEach(() => {
    recorder = new JournalRecorder();
  });

  it('records entries and counts correctly', () => {
    expect(recorder.count()).toBe(0);
    recorder.record(makeEntry('1', 1.5));
    recorder.record(makeEntry('2', -1.0));
    expect(recorder.count()).toBe(2);
    expect(recorder.getAll().length).toBe(2);
  });

  it('clears entries correctly', () => {
    recorder.record(makeEntry('1', 1.5));
    recorder.clear();
    expect(recorder.count()).toBe(0);
  });

  it('returns null for rate-based metrics if sample count < 30', () => {
    for (let i = 0; i < 29; i++) {
      recorder.record(makeEntry(`id_${i}`, 1.0));
    }
    const summary = recorder.summarize();
    expect(summary.sampleCount).toBe(29);
    expect(summary.winRate).toBeNull();
    expect(summary.expectancyR).toBeNull();
    expect(summary.profitFactor).toBeNull();
    expect(summary.maxDrawdownPct).toBeNull();
    expect(summary.averageR).toBeNull();
    expect(summary.medianR).toBeNull();
    expect(summary.byRegime['TREND_UP']).toBe(29);
    expect(summary.bySession['LONDON']).toBe(29);
  });

  it('calculates metrics accurately when sample count >= 30', () => {
    // 20 winners with +2R, 10 losers with -1R (30 completed trades)
    for (let i = 0; i < 20; i++) {
      recorder.record(makeEntry(`w_${i}`, 2.0));
    }
    for (let i = 0; i < 10; i++) {
      recorder.record(makeEntry(`l_${i}`, -1.0));
    }

    const summary = recorder.summarize();
    expect(summary.sampleCount).toBe(30);
    expect(summary.winRate).toBeCloseTo(20 / 30, 4);
    // (20*2 + 10*-1) / 30 = 30 / 30 = 1.0
    expect(summary.averageR).toBeCloseTo(1.0, 4);
    expect(summary.expectancyR).toBeCloseTo(1.0, 4);
    // Gross profit: 40, Gross loss: 10 -> Profit Factor: 4.0
    expect(summary.profitFactor).toBeCloseTo(4.0, 4);
  });
});
