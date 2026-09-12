import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  SMCAnalysis, 
  PostTradeRecord, 
  SMCConfig, 
  TelegramConfig, 
  ExecutionLog 
} from '../types';

export interface FirestoreSignalRecord {
  id?: string;
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
}

/**
 * Save an SMC Institutional Signal to Firestore
 */
export async function saveSignalToFirestore(
  analysis: SMCAnalysis, 
  status: 'ACTIVE' | 'MITIGATED' | 'HIT_TP' | 'HIT_SL' = 'ACTIVE'
): Promise<string | null> {
  try {
    const colRef = collection(db, 'signals');
    const docData = {
      bias: analysis.bias,
      action: analysis.action,
      currentPrice: analysis.currentPrice,
      entryMin: analysis.entryZone.min,
      entryMax: analysis.entryZone.max,
      stopLoss: analysis.stopLoss,
      takeProfit: analysis.takeProfit,
      riskReward: analysis.riskRewardRatio,
      rrNumeric: analysis.rrNumeric,
      confluenceScore: analysis.confluenceScore,
      structure: analysis.structure,
      reason: analysis.reason,
      status,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    };
    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  } catch (error) {
    console.warn('[Firestore] Failed to save signal:', error);
    return null;
  }
}

/**
 * Retrieve recent signals from Firestore
 */
export async function getRecentSignalsFromFirestore(limitCount: number = 20): Promise<FirestoreSignalRecord[]> {
  try {
    const colRef = collection(db, 'signals');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<FirestoreSignalRecord, 'id'>)
    }));
  } catch (error) {
    console.warn('[Firestore] Failed to fetch signals:', error);
    return [];
  }
}

/**
 * Save a trade journal record to Firestore
 */
export async function saveJournalEntryToFirestore(record: Omit<PostTradeRecord, 'id'>): Promise<string | null> {
  try {
    const colRef = collection(db, 'trade_journal');
    const docData = {
      ...record,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    };
    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  } catch (error) {
    console.warn('[Firestore] Failed to save trade journal entry:', error);
    return null;
  }
}

/**
 * Retrieve trade journal entries from Firestore
 */
export async function getJournalEntriesFromFirestore(limitCount: number = 50): Promise<PostTradeRecord[]> {
  try {
    const colRef = collection(db, 'trade_journal');
    const q = query(colRef, orderBy('date', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<PostTradeRecord, 'id'>)
    }));
  } catch (error) {
    console.warn('[Firestore] Failed to fetch journal entries:', error);
    return [];
  }
}

/**
 * Save platform configuration (SMC settings & Telegram) to Firestore
 */
export async function savePlatformConfigToFirestore(
  smcConfig: SMCConfig, 
  telegramConfig: TelegramConfig
): Promise<boolean> {
  try {
    const docRef = doc(db, 'platform_config', 'current');
    await setDoc(docRef, {
      smcConfig,
      telegramConfig,
      updatedAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn('[Firestore] Failed to save platform config:', error);
    return false;
  }
}

/**
 * Load platform configuration from Firestore
 */
export async function loadPlatformConfigFromFirestore(): Promise<{
  smcConfig?: SMCConfig;
  telegramConfig?: TelegramConfig;
} | null> {
  try {
    const docRef = doc(db, 'platform_config', 'current');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data() as { smcConfig?: SMCConfig; telegramConfig?: TelegramConfig };
    }
    return null;
  } catch (error) {
    console.warn('[Firestore] Failed to load platform config:', error);
    return null;
  }
}

/**
 * Save execution log entry to Firestore
 */
export async function saveExecutionLogToFirestore(log: ExecutionLog): Promise<boolean> {
  try {
    const colRef = collection(db, 'execution_logs');
    await addDoc(colRef, {
      step: log.step,
      status: log.status,
      message: log.message,
      details: log.details || '',
      timestamp: log.timestamp || new Date().toISOString(),
      serverTime: serverTimestamp(),
    });
    return true;
  } catch (error) {
    // Silent fail for logs to not interrupt flow
    return false;
  }
}

/**
 * Subscribe to real-time updates for signals
 */
export function subscribeToSignals(callback: (signals: FirestoreSignalRecord[]) => void) {
  try {
    const colRef = collection(db, 'signals');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(15));
    return onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<FirestoreSignalRecord, 'id'>)
      }));
      callback(records);
    }, (err) => {
      console.warn('[Firestore] Signal snapshot subscription error:', err);
    });
  } catch (e) {
    console.warn('[Firestore] Could not attach listener:', e);
    return () => {};
  }
}
