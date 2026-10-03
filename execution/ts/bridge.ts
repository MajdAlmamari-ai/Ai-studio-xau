// execution/ts/bridge.ts
import pino from 'pino';
import { getRedis, shutdownRedis } from '../../spot_engine/ts/shared/redis_client';
import { IBrokerAdapter } from './interfaces/IBrokerAdapter';
import { OandaAdapter } from './adapters/OandaAdapter';
import { PaperAdapter } from './adapters/PaperAdapter';
import { OrderStateMachine, ManagedOrder } from './state/OrderStateMachine';
import { PreTradeRiskGuard } from './risk/PreTradeRisk';
import { AccountSynchronizer } from './account/AccountSync';
import { ExecutionDecision, TradePlan, AccountState } from '../../shared/types';

const logger = pino({ name: 'ExecutionBridge' });

export class ExecutionBridge {
  private adapter: IBrokerAdapter;
  private orderFSM: OrderStateMachine;
  private riskGuard: PreTradeRiskGuard;
  private accountSync: AccountSynchronizer;
  private isRunning = false;

  constructor(usePaper: boolean = true) {
    this.adapter = usePaper ? new PaperAdapter() : new OandaAdapter();
    
    this.orderFSM = new OrderStateMachine(this.adapter);
    this.riskGuard = new PreTradeRiskGuard(this.adapter);
    this.accountSync = new AccountSynchronizer(this.adapter, 5000);

    this.orderFSM.setCallbacks(
      this.handleFill.bind(this),
      this.handleStatusChange.bind(this)
    );
  }

  async start(): Promise<void> {
    logger.info('🚀 EXECUTION BRIDGE STARTING...');
    
    await this.adapter.connect();
    logger.info(`✅ Broker Connected: ${this.adapter.brokerName}`);

    this.accountSync.start();

    await this.adapter.subscribeMarketData((tick) => {
      getRedis().hset('market:live:XAUUSD', 'bid', tick.bid, 'ask', tick.ask, 'ts', tick.ts).catch(() => {});
    });

    await this.adapter.subscribeAccountEvents(() => {
      this.accountSync.sync().catch(() => {});
    });

    this.isRunning = true;
    this.consumeOrders();
    
    logger.info('🟢 EXECUTION BRIDGE OPERATIONAL');
  }

  private async consumeOrders(): Promise<void> {
    const redis = getRedis();
    const GROUP = 'execution_bridge_group';
    const CONSUMER = `bridge-${process.pid}`;
    const STREAM = 'orders:live';

    await redis.xgroup('CREATE', STREAM, GROUP, '0', 'MKSTREAM').catch(() => {});

    while (this.isRunning) {
      try {
        const res = await (redis as any).xreadgroup(
          'GROUP', GROUP, CONSUMER,
          'COUNT', 5,
          'BLOCK', 5000,
          'STREAMS', STREAM, '>'
        );
        if (!res) continue;

        for (const [, messages] of res) {
          for (const [msgId, fields] of messages) {
            const data: Record<string, string> = {};
            for (let i = 0; i < fields.length; i += 2) {
              data[fields[i]] = fields[i + 1];
            }

            if (data.plan) {
              const plan = JSON.parse(data.plan) as TradePlan;
              const decision: ExecutionDecision = { 
                action: 'EXECUTE', 
                plan, 
                confidence: parseFloat(data.confidence || '1'), 
                notes: data.notes ? JSON.parse(data.notes) : [] 
              };

              await this.processOrder(decision);
            }
            await redis.xack(STREAM, GROUP, msgId).catch(() => {});
          }
        }
      } catch (err: any) {
        logger.error({ err: err?.message || err }, 'Order Consumption Error');
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  private async processOrder(decision: ExecutionDecision): Promise<void> {
    if (!decision.plan) return;
    
    const snapshot = await this.adapter.getAccountSnapshot();
    const accountState: AccountState = {
      equity: snapshot.equity,
      balance: snapshot.balance,
      free_margin: snapshot.freeMargin,
      used_margin: snapshot.usedMargin,
      leverage: 20.0,
      stop_out_pct: 0.2,
      currency: 'USD',
      liveSpread: snapshot.liveSpread,
      spreadAvg1h: snapshot.spreadAvg1h,
    };

    const riskCheck = await this.riskGuard.validate(decision.plan, accountState);
    
    if (!riskCheck.allowed) {
      logger.warn({ reason: riskCheck.reason, plan: decision.plan }, '🛑 PRE-TRADE RISK REJECT');
      await getRedis().xadd('orders:rejected', '*', 
        'signal_id', decision.plan.id || 'unknown',
        'reason', `RISK_REJECT: ${riskCheck.reason}`,
        'timestamp', Date.now().toString()
      ).catch(() => {});
      return;
    }

    const order = await this.orderFSM.submit(decision);
    logger.info({ id: order.id, brokerId: order.brokerId, lot: decision.plan.lot_size }, '📤 ORDER SUBMITTED TO BROKER');
  }

  private async handleFill(order: ManagedOrder, fill: any): Promise<void> {
    logger.info({ id: order.id, price: fill.price, vol: fill.volume }, '✅ FILL RECEIVED');
    
    await getRedis().xadd('fills:live', '*',
      'order_id', order.id,
      'broker_id', order.brokerId || '',
      'price', fill.price.toString(),
      'volume', fill.volume.toString(),
      'side', order.plan.dir,
      'timestamp', fill.timestamp.toString()
    ).catch(() => {});
  }

  private async handleStatusChange(order: ManagedOrder): Promise<void> {
    if (['FILLED', 'REJECTED', 'CANCELLED'].includes(order.status)) {
      logger.info({ id: order.id, status: order.status, avgPx: order.avgFillPrice }, '🏁 ORDER TERMINAL STATE');
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.accountSync.stop();
    await this.adapter.disconnect();
    await shutdownRedis();
  }
}
