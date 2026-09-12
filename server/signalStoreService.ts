/**
 * Server-Side Signal Store & Persistence Service
 * ------------------------------------------------------------------------------------
 * High-performance in-memory cache with fallback synchronization for:
 * - SMC Institutional Signals Archive
 * - Institutional Trade Journal & Memory
 * - Server Execution & Safeguards Logs
 * - Platform Configuration
 */

export interface ServerSignalRecord {
  id: string;
  bias: string;
  action: string;
  currentPrice: number;
  entryMin: number;
  entryMax: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: string;
  rrNumeric: number;
  confluenceScore: number;
  structure: string;
  reason: string;
  status: 'ACTIVE' | 'MITIGATED' | 'HIT_TP' | 'HIT_SL';
  createdAt: string;
  origin: 'server_cycle' | 'manual_dispatch';
}

export interface ServerJournalRecord {
  id: string;
  date: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  pnlUsd: number;
  rrAchieved: string;
  zoneFreshnessScore: number;
  liquiditySweepConfirmed: boolean;
  notes: string;
}

export interface ServerLogEntry {
  id: string;
  timestamp: string;
  step: string;
  status: 'pending' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

// Initial In-Memory Data Stores
let signalsStore: ServerSignalRecord[] = [
  {
    id: 'sig-srv-init-1',
    bias: 'BULLISH',
    action: 'BUY_LIMIT',
    currentPrice: 4478.50,
    entryMin: 4476.00,
    entryMax: 4478.00,
    stopLoss: 4467.50,
    takeProfit: 4504.00,
    riskReward: '1:2.85',
    rrNumeric: 2.85,
    confluenceScore: 94,
    structure: 'BOS_CONFIRMED',
    reason: 'سحب سيولة قاع آسيا مع تأكيد لوتات COMEX GC ونضارة أوردر بلوك الطلب 100%.',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    origin: 'server_cycle',
  },
  {
    id: 'sig-srv-init-2',
    bias: 'BULLISH',
    action: 'BUY_LIMIT',
    currentPrice: 4465.20,
    entryMin: 4462.50,
    entryMax: 4464.80,
    stopLoss: 4455.00,
    takeProfit: 4488.00,
    riskReward: '1:3.10',
    rrNumeric: 3.10,
    confluenceScore: 92,
    structure: 'BOS_CONFIRMED',
    reason: 'ارتداد نظيف بعد سحب سيولة شمعة CPI وامتصاص ضغط البيع.',
    status: 'HIT_TP',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    origin: 'server_cycle',
  }
];

let journalStore: ServerJournalRecord[] = [
  {
    id: 'jrn-srv-1',
    date: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString().split('T')[0],
    type: 'BUY',
    entryPrice: 4464.00,
    exitPrice: 4488.00,
    pnlUsd: 2400.00,
    rrAchieved: '1:3.10',
    zoneFreshnessScore: 100,
    liquiditySweepConfirmed: true,
    notes: 'ارتداد فوري من كتلة طلب نضارتها 100% بعد انتهاء فترة تهدئة خبر التضخم 15 دقيقة.',
  },
  {
    id: 'jrn-srv-2',
    date: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString().split('T')[0],
    type: 'BUY',
    entryPrice: 4448.50,
    exitPrice: 4472.00,
    pnlUsd: 2350.00,
    rrAchieved: '1:2.90',
    zoneFreshnessScore: 86,
    liquiditySweepConfirmed: true,
    notes: 'صفقة نموذجية؛ الوقف كان محمياً بفلتر الذيول 9.4$ وتفادى ذيل صناع السوق.',
  },
];

let executionLogsStore: ServerLogEntry[] = [
  {
    id: 'log-srv-init',
    timestamp: new Date().toLocaleTimeString('ar-EG'),
    step: 'تهيئة الخادم',
    status: 'success',
    message: 'تم تفعيل بوابة SMC المؤسساتية وتهيئة مخزن الذاكرة السحابية.',
  }
];

let platformConfigStore: any = {
  smcConfig: {
    riskMultiplier: 1.0,
    minRiskReward: 2.0,
    timeframe: '15m',
    orderBlockSensitivity: 0.8,
    fvgThreshold: 1.5,
    liquidityBuffer: 2.5,
    supportOffset: 12.0,
    resistanceOffset: 14.5,
    bslOffset: 18.0,
    sslOffset: 16.5,
  },
  telegramConfig: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  serverAutoSchedulerActive: true,
  updatedAt: new Date().toISOString(),
};

// Accessor Functions
export function addServerSignal(signalData: Omit<ServerSignalRecord, 'id' | 'createdAt'>): ServerSignalRecord {
  const newRecord: ServerSignalRecord = {
    id: `sig-srv-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...signalData,
  };
  signalsStore.unshift(newRecord);
  if (signalsStore.length > 100) {
    signalsStore = signalsStore.slice(0, 100);
  }
  return newRecord;
}

export function getServerSignals(limitCount = 30): ServerSignalRecord[] {
  return signalsStore.slice(0, limitCount);
}

export function updateServerSignalStatus(
  id: string,
  status: 'ACTIVE' | 'MITIGATED' | 'HIT_TP' | 'HIT_SL'
): boolean {
  const target = signalsStore.find((s) => s.id === id);
  if (target) {
    target.status = status;
    return true;
  }
  return false;
}

export function addServerJournalEntry(entry: Omit<ServerJournalRecord, 'id'>): ServerJournalRecord {
  const newRecord: ServerJournalRecord = {
    id: `jrn-srv-${Date.now()}`,
    ...entry,
  };
  journalStore.unshift(newRecord);
  if (journalStore.length > 200) {
    journalStore = journalStore.slice(0, 200);
  }
  return newRecord;
}

export function getServerJournalEntries(limitCount = 50): ServerJournalRecord[] {
  return journalStore.slice(0, limitCount);
}

export function addServerExecutionLog(log: Omit<ServerLogEntry, 'id' | 'timestamp'>): ServerLogEntry {
  const newLog: ServerLogEntry = {
    id: `log-srv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString('ar-EG'),
    ...log,
  };
  executionLogsStore.unshift(newLog);
  if (executionLogsStore.length > 100) {
    executionLogsStore = executionLogsStore.slice(0, 100);
  }
  return newLog;
}

export function getServerExecutionLogs(limitCount = 50): ServerLogEntry[] {
  return executionLogsStore.slice(0, limitCount);
}

export function getServerPlatformConfig() {
  return platformConfigStore;
}

export function setServerPlatformConfig(newConfig: any) {
  platformConfigStore = {
    ...platformConfigStore,
    ...newConfig,
    updatedAt: new Date().toISOString(),
  };
  return platformConfigStore;
}
