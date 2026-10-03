// orchestrator/ts/main.ts
import pino from 'pino';
import { getRedis, shutdownRedis } from '../../spot_engine/ts/shared/redis_client';
import { ConfluenceEngine } from './confluence_engine';
import { StructureSignal, AccountState } from '../../shared/types';

const logger = pino({ name: 'OrchestratorService' });

async function main() {
  logger.info('🚀 GOLD DESK QUANT — ORCHESTRATOR SERVICE STARTING (PHASE 3)');

  const redis = getRedis();
  const engine = new ConfluenceEngine();
  const SIGNAL_STREAM = 'spot:signals';
  const ORDER_STREAM = 'orders:live';
  const GROUP = 'orchestrator_group';
  const CONSUMER = `orchestrator-${process.pid}`;

  await redis.xgroup('CREATE', SIGNAL_STREAM, GROUP, '0', 'MKSTREAM').catch(() => {});

  let isRunning = true;
  const shutdown = async (sig: string) => {
    logger.warn({ sig }, 'Orchestrator shutting down...');
    isRunning = false;
    await shutdownRedis();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  logger.info('🟢 ORCHESTRATOR OPERATIONAL. Listening for spot:signals and matching futures:levels...');

  while (isRunning) {
    try {
      const res = await (redis as any).xreadgroup(
        'GROUP', GROUP, CONSUMER,
        'COUNT', 5,
        'BLOCK', 5000,
        'STREAMS', SIGNAL_STREAM, '>'
      );

      if (!res) continue;

      for (const [, messages] of res) {
        for (const [msgId, fields] of messages) {
          const rawData: Record<string, any> = {};
          for (let i = 0; i < fields.length; i += 2) {
            try {
              rawData[fields[i]] = JSON.parse(fields[i + 1]);
            } catch {
              rawData[fields[i]] = fields[i + 1];
            }
          }

          const signal: StructureSignal = {
            id: rawData.id || `sig_${Date.now()}`,
            dir: rawData.dir === 'SHORT' ? 'SHORT' : 'LONG',
            entry: parseFloat(rawData.entry || '2650'),
            sl: parseFloat(rawData.sl || '2640'),
            tps: Array.isArray(rawData.tps) ? rawData.tps : [2665, 2675],
            baseConfidence: parseFloat(rawData.baseConfidence || '0.7'),
            created_at: parseInt(rawData.created_at || Date.now(), 10),
            expires_at: parseInt(rawData.expires_at || Date.now() + 3600000, 10),
            half_life_ms: parseInt(rawData.half_life_ms || 1800000, 10),
            source_structure: rawData.source_structure || 'OB',
          };

          const levels = await engine.loadLatestLevels();
          const account: AccountState = {
            equity: 100000,
            balance: 100000,
            free_margin: 100000,
            used_margin: 0,
            leverage: 20,
            stop_out_pct: 0.2,
            currency: 'USD',
            liveSpread: 0.3,
            spreadAvg1h: 0.3,
          };

          const evaluation = engine.evaluateSignal(signal, levels, account, 0.3);
          logger.info({ id: signal.id, action: evaluation.decision.action, notes: evaluation.reasons }, 'Signal Evaluated');

          if (evaluation.decision.action === 'EXECUTE' && evaluation.decision.plan) {
            await redis.xadd(ORDER_STREAM, '*', 
              'plan', JSON.stringify(evaluation.decision.plan),
              'confidence', (evaluation.decision.confidence || 0.8).toString(),
              'notes', JSON.stringify(evaluation.decision.notes || []),
              'timestamp', Date.now().toString()
            );
            logger.info({ id: signal.id, lot: evaluation.decision.plan.lot_size }, '🎯 ORDER PUSHED TO orders:live');
          }

          await redis.xack(SIGNAL_STREAM, GROUP, msgId).catch(() => {});
        }
      }
    } catch (err: any) {
      logger.error({ err: err?.message || err }, 'Orchestrator Loop Error');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    logger.fatal({ err }, 'Orchestrator Fatal Startup Error');
    process.exit(1);
  });
}

export { main };
