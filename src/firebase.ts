/**
 * Firebase initialization (safe-fallback version).
 *
 * Config sources (in order):
 *   1. firebase-applet-config.json (if present)
 *   2. Environment variables (VITE_FIREBASE_*)
 *   3. No config (db = null; consumers must handle)
 *
 * NEVER commit real Firebase config to git.
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

function loadConfigFromEnv(): FirebaseConfig | null {
  const env = (import.meta as any).env as Record<string, string | undefined>;
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const appId = env.VITE_FIREBASE_APP_ID;

  if (!apiKey || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId,
  };
}

async function loadConfigFromFile(): Promise<FirebaseConfig | null> {
  try {
    // Dynamic import with variable — bypasses TypeScript compile-time static module lookup
    const configPath = '../firebase-applet-config.json';
    const mod: any = await import(
      /* @vite-ignore */
      configPath
    ).catch(() => null);

    if (mod && mod.default && mod.default.apiKey) {
      return mod.default as FirebaseConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export async function initFirebase(): Promise<void> {
  if (app) return;

  let config = await loadConfigFromFile();
  if (!config) {
    config = loadConfigFromEnv();
  }

  if (!config) {
    console.warn(
      '[Firebase] No config available. Firestore features disabled.'
    );
    return;
  }

  try {
    app = initializeApp(config);
    db = getFirestore(app);
    console.info('[Firebase] Initialized.');
  } catch (err) {
    console.warn('[Firebase] Init failed:', err);
    app = null;
    db = null;
  }
}

export function getFirebaseDb(): Firestore | null {
  return db;
}

export { app, db };

// Auto-init (non-blocking).
initFirebase().catch((err) => {
  console.warn('[Firebase] Auto-init failed:', err);
});
