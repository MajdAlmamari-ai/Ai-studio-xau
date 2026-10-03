// spot_engine/ts/shared/redis_client.ts
import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'RedisClient' });

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redisInstance = new (Redis as any)(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 200, 2000),
      lazyConnect: true,
      enableReadyCheck: true,
    });

    redisInstance!.on('connect', () => logger.info({ url }, 'Redis Connected'));
    redisInstance!.on('error', (err: any) => logger.error({ err }, 'Redis Error'));
    redisInstance!.on('close', () => logger.warn('Redis Connection Closed'));
    
    redisInstance!.connect().catch((err: any) => logger.fatal({ err }, 'Redis Initial Connect Failed'));
  }
  return redisInstance!;
}

export async function shutdownRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    logger.info('Redis Disconnected Gracefully');
  }
}
