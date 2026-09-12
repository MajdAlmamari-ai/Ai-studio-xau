import { PostTradeRecord } from '../types';
import { saveJournalEntryToFirestore, getJournalEntriesFromFirestore } from './firestoreService';

const STORAGE_KEY = 'xauusd_post_trade_records';

export const INITIAL_POST_TRADE_RECORDS: PostTradeRecord[] = [
  {
    id: 'ptr-001',
    date: '2026-09-04 11:15',
    action: 'BUY',
    entryPrice: 4468.50,
    exitPrice: 4482.00,
    stopLoss: 4464.20,
    takeProfit: 4480.00,
    pnlDollar: +13.50,
    result: 'WIN',
    obRespected: true,
    hadSweepBefore: true,
    obFreshness: 95, // 4 bars old
    durationMinutes: 48,
    lessonLearnedAr: 'احترام مثالي لكتلة الطلب (Demand OB) بعد سحب سيولة قاع شمعة الأخبار (Sweep)، ونضارة المنطقة العالية (95%) منحت الصفقة زخماً انفجارياً سريعاً دون ارتداد.',
  },
  {
    id: 'ptr-002',
    date: '2026-09-03 16:30',
    action: 'BUY',
    entryPrice: 4452.00,
    exitPrice: 4466.00,
    stopLoss: 4447.80,
    takeProfit: 4465.00,
    pnlDollar: +14.00,
    result: 'WIN',
    obRespected: true,
    hadSweepBefore: true,
    obFreshness: 85, // 7 bars old
    durationMinutes: 65,
    lessonLearnedAr: 'تأكيد تدفق الأوامر عبر عقود GC الآجلة في CME مع دلتا إيجابية تخطت +3500 عقد، وارتداد مباشر من نقطة توازن FVG BISI.',
  },
  {
    id: 'ptr-003',
    date: '2026-09-02 14:00',
    action: 'SELL',
    entryPrice: 4485.00,
    exitPrice: 4488.50,
    stopLoss: 4488.50,
    takeProfit: 4470.00,
    pnlDollar: -3.50,
    result: 'LOSS',
    obRespected: false,
    hadSweepBefore: false,
    obFreshness: 25, // 18 bars old (Eroded)
    durationMinutes: 22,
    lessonLearnedAr: 'فشل الـ OB ناتج عن تآكل المنطقة (نضارة 25% فقط وعمر 18 شمعة) مع غياب سحب السيولة (Sweep) قبل الدخول. تم تحسين فلتر نضارة المناطق لمنع الدخول دون نضارة 60%.',
  },
  {
    id: 'ptr-004',
    date: '2026-09-01 10:45',
    action: 'BUY',
    entryPrice: 4438.20,
    exitPrice: 4454.00,
    stopLoss: 4434.00,
    takeProfit: 4452.00,
    pnlDollar: +15.80,
    result: 'WIN',
    obRespected: true,
    hadSweepBefore: true,
    obFreshness: 100, // 3 bars old
    durationMinutes: 90,
    lessonLearnedAr: 'صفقة نموذجية من كتاب SMC: سحب سيولة SSL ثم تشكل فجوة FVG طازجة واختبار نقطة الـ CE 50% مع احترام تام لوقف الخسارة المحمي بفلتر الذيول.',
  },
];

export function getPostTradeRecords(): PostTradeRecord[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // fallback
  }
  return INITIAL_POST_TRADE_RECORDS;
}

export function savePostTradeRecord(record: PostTradeRecord): PostTradeRecord[] {
  const current = getPostTradeRecords();
  const updated = [record, ...current];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    // ignore
  }
  // Asynchronously persist to Firebase Firestore
  saveJournalEntryToFirestore(record).catch(() => {});
  return updated;
}

/**
 * Fetch and merge records from Firestore with local storage
 */
export async function syncJournalWithFirestore(): Promise<PostTradeRecord[]> {
  try {
    const remoteRecords = await getJournalEntriesFromFirestore(50);
    if (remoteRecords && remoteRecords.length > 0) {
      const current = getPostTradeRecords();
      const idMap = new Set(current.map(r => r.id));
      const newItems = remoteRecords.filter(r => !idMap.has(r.id));
      if (newItems.length > 0) {
        const merged = [...newItems, ...current];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (e) {
    console.warn('[Journal Sync] Firestore sync fallback:', e);
  }
  return getPostTradeRecords();
}

export function calculateJournalStatistics(records: PostTradeRecord[]) {
  if (!records.length) {
    return {
      totalTrades: 0,
      winRate: '0%',
      profitFactor: 0,
      sweepCorrelation: '0%',
      freshnessWinRateHigh: '0%',
      freshnessWinRateLow: '0%',
      avgDurationMinutes: 0,
      totalPnlDollars: 0,
    };
  }

  const wins = records.filter((r) => r.result === 'WIN');
  const losses = records.filter((r) => r.result === 'LOSS');
  const winRate = ((wins.length / records.length) * 100).toFixed(1);

  const totalWinPnl = wins.reduce((acc, r) => acc + r.pnlDollar, 0);
  const totalLossPnl = Math.abs(losses.reduce((acc, r) => acc + r.pnlDollar, 0));
  const profitFactor = totalLossPnl > 0 ? Number((totalWinPnl / totalLossPnl).toFixed(2)) : totalWinPnl > 0 ? 9.9 : 1.0;

  // Correlation with Sweep
  const winsWithSweep = wins.filter((r) => r.hadSweepBefore).length;
  const sweepCorrelation = wins.length > 0 ? ((winsWithSweep / wins.length) * 100).toFixed(1) : '0';

  // Win rate by Freshness
  const highFreshnessTrades = records.filter((r) => r.obFreshness >= 80);
  const highFreshnessWins = highFreshnessTrades.filter((r) => r.result === 'WIN').length;
  const freshnessWinRateHigh = highFreshnessTrades.length > 0
    ? ((highFreshnessWins / highFreshnessTrades.length) * 100).toFixed(1)
    : '100';

  const lowFreshnessTrades = records.filter((r) => r.obFreshness < 50);
  const lowFreshnessWins = lowFreshnessTrades.filter((r) => r.result === 'WIN').length;
  const freshnessWinRateLow = lowFreshnessTrades.length > 0
    ? ((lowFreshnessWins / lowFreshnessTrades.length) * 100).toFixed(1)
    : '25.0';

  const totalDuration = records.reduce((acc, r) => acc + r.durationMinutes, 0);
  const avgDurationMinutes = Math.round(totalDuration / records.length);
  const totalPnlDollars = Number(records.reduce((acc, r) => acc + r.pnlDollar, 0).toFixed(2));

  return {
    totalTrades: records.length,
    winRate: `${winRate}%`,
    profitFactor,
    sweepCorrelation: `${sweepCorrelation}%`,
    freshnessWinRateHigh: `${freshnessWinRateHigh}%`,
    freshnessWinRateLow: `${freshnessWinRateLow}%`,
    avgDurationMinutes,
    totalPnlDollars,
  };
}
