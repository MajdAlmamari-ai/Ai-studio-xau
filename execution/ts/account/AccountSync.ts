// execution/ts/account/AccountSync.ts
import pino from 'pino';
import { getRedis } from '../../../spot_engine/ts/shared/redis_client';
import { IBrokerAdapter } from '../interfaces/IBrokerAdapter';

const logger = pino({ name: 'AccountSync' });

export class AccountSynchronizer {
  private adapter: IBrokerAdapter;
  private intervalMs: number;
  private timer?: NodeJS.Timeout;

  constructor(adapter: IBrokerAdapter, intervalMs: number = 5000) {
    this.adapter = adapter;
    this.intervalMs = intervalMs;
  }

  start(): void {
    this.sync().catch((e) => logger.error({ e: e?.message || e }, 'Initial Account Sync Failed'));
    this.timer = setInterval(() => this.sync().catch(() => {}), this.intervalMs);
    logger.info({ interval: this.intervalMs }, 'Account Synchronizer Started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sync(): Promise<void> {
    try {
      const snapshot = await this.adapter.getAccountSnapshot();
      const redis = getRedis();
      
      await redis.xadd('account:state', '*', 
        'equity', snapshot.equity.toString(),
        'balance', snapshot.balance.toString(),
        'free_margin', snapshot.freeMargin.toString(),
        'used_margin', snapshot.usedMargin.toString(),
        'leverage', '20',
        'stop_out_pct', '0.2',
        'currency', 'USD',
        'liveSpread', snapshot.liveSpread.toString(),
        'spreadAvg1h', snapshot.spreadAvg1h.toString(),
        'positions', JSON.stringify(snapshot.positions),
        'timestamp', Date.now().toString()
      ).catch(() => {});

      await redis.set('account:latest', JSON.stringify(snapshot), 'EX', 10).catch(() => {});
    } catch (e: any) {
      logger.error({ e: e?.message || e }, 'Account Sync Failed');
    }
  }
}
