// execution/ts/main.ts
import pino from 'pino';
import { getRedis } from '../../spot_engine/ts/shared/redis_client';
import { ExecutionBridge } from './bridge';

const logger = pino({ 
  level: process.env.LOG_LEVEL || 'info',
});

// ──────────────────────────────────────────────────────────────────────────────
// ENV VALIDATION
// ──────────────────────────────────────────────────────────────────────────────
const REQUIRED_ENV = ['OANDA_TOKEN', 'OANDA_ACCOUNT_ID', 'OANDA_ENV'];
const USE_PAPER = process.env.USE_PAPER !== 'false'; // Default to Paper for safety

if (!USE_PAPER) {
  for (const k of REQUIRED_ENV) {
    if (!process.env[k]) {
      logger.fatal({ missing: k }, 'Missing Required Env Var for Live Trading');
      process.exit(1);
    }
  }
  logger.warn('⚠️ RUNNING IN LIVE MODE. REAL MONEY AT RISK.');
} else {
  logger.info('🧪 RUNNING IN PAPER MODE (Simulator).');
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  logger.info('🚀 EXECUTION BRIDGE SERVICE STARTING (PHASE 4)');
  
  const redis = getRedis();
  try {
    await new Promise<void>((res, rej) => {
      if (redis.status === 'ready') {
        res();
        return;
      }
      redis.once('ready', () => res());
      redis.once('error', rej);
      setTimeout(() => {
        logger.warn('Redis connection deferred; running simulator in offline mode');
        res();
      }, 3000);
    });
    logger.info('✅ Redis Ready');
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, 'Redis connection warning, continuing in simulator mode');
  }

  const bridge = new ExecutionBridge(USE_PAPER);
  
  const shutdown = async (sig: string) => {
    logger.warn({ signal: sig }, 'Shutdown Initiated...');
    await bridge.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await bridge.start();
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    logger.fatal({ err }, 'Execution Bridge Fatal Error');
    process.exit(1);
  });
}

export { main };
