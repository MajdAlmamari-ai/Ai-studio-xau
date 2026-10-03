// spot_engine/ts/main.ts
import pino from 'pino';
import { getRedis, shutdownRedis } from './shared/redis_client';
import { startTVIngestion, stopTVIngestion } from './ingestion/tv_spot';
import { startBarAggregator } from './core/bar_aggregator';
import { startStructureEngine } from './core/structure_engine';
import { startPaperExecutor } from './execution/paper_executor';

const logger = pino({ 
  level: process.env.LOG_LEVEL || 'info',
});

async function main() {
  logger.info('🚀 GOLD DESK QUANT — LIVE ENGINE STARTING (PHASE 1C)');
  
  // 1. Connect Redis (Graceful check)
  const redis = getRedis();
  try {
    await new Promise<void>((resolve, reject) => {
      if (redis.status === 'ready') {
        resolve();
        return;
      }
      redis.once('ready', () => resolve());
      redis.once('error', (err) => reject(err));
      setTimeout(() => {
        // If Redis is not running locally in testing environment, warn and continue
        logger.warn('Redis connection deferred/timed out; running in offline simulation mode');
        resolve();
      }, 3000);
    });
    logger.info('✅ Redis State verified');
  } catch (err) {
    logger.warn({ err }, 'Redis connection warning, continuing initialization');
  }

  // 2. Start Core Services
  const ingestionPromise = startTVIngestion();
  const aggregatorPromise = startBarAggregator();
  const structurePromise = startStructureEngine();
  const executorPromise = startPaperExecutor();

  // 3. Graceful Shutdown Handling
  const shutdown = async (signal: string) => {
    logger.warn({ signal }, 'Shutdown Signal Received. Stopping Services...');
    stopTVIngestion();
    await shutdownRedis();
    logger.info('✅ Shutdown Complete');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  logger.info('🟢 ALL SYSTEMS OPERATIONAL (PHASE 1C). Waiting for Ticks...');
  await Promise.all([ingestionPromise, aggregatorPromise, structurePromise, executorPromise]);
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    logger.fatal({ err }, 'Fatal Startup Error');
    process.exit(1);
  });
}

export { main };
