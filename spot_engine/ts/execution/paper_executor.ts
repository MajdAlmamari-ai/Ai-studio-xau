// spot_engine/ts/execution/paper_executor.ts
import pino from 'pino';
import { getRedis } from '../shared/redis_client';
import { type TradePlan, type StructureSignal } from '../../../shared/types';

const logger = pino({ name: 'PaperExecutor' });

const SIGNAL_STREAM = 'spot:signals';
const FILL_STREAM = 'fills:paper';
const CONSUMER_GROUP = 'paper_exec_group';
const CONSUMER_NAME = `paper_exec-${process.pid}`;

interface OpenOrder {
  plan: TradePlan;
  signal: StructureSignal;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  fillPrice?: number;
  fillTs?: number;
}

const openOrders: Map<string, OpenOrder> = new Map();
const currentAccount: any = { 
  equity: 100000,
  balance: 100000,
  free_margin: 100000,
  used_margin: 0, 
  leverage: 20,
  stop_out_pct: 0.2,
  currency: 'USD',
  liveSpread: 0.3,
  spreadAvg1h: 0.3 
};

function simulateFill(plan: TradePlan, bar: any): { price: number; slip: number } | null {
  const spread = bar.spread_avg || currentAccount.liveSpread;
  const slipPips = (spread / 2) + 0.5;
  const slipPrice = slipPips * 0.01;

  if (plan.dir === 'LONG') {
    if (bar.bid_l <= plan.entry) { // Bid Low hit our Limit
      const fill = Math.min(plan.entry, bar.bid_l + slipPrice);
      return { price: fill, slip: fill - plan.entry };
    }
  } else {
    if (bar.ask_h >= plan.entry) {
      const fill = Math.max(plan.entry, bar.ask_h - slipPrice);
      return { price: fill, slip: plan.entry - fill };
    }
  }
  return null;
}

async function processBar(bar: any): Promise<void> {
  for (const [id, order] of openOrders) {
    if (order.status !== 'PENDING') continue;
    
    const fill = simulateFill(order.plan, bar);
    if (fill) {
      order.status = 'FILLED';
      order.fillPrice = fill.price;
      order.fillTs = bar.ts_ms;
      
      currentAccount.used_margin += order.plan.margin_req;
      currentAccount.free_margin -= order.plan.margin_req;
      
      await getRedis().xadd(FILL_STREAM, '*', 
        'order_id', id,
        'price', fill.price.toString(),
        'slip', fill.slip.toString(),
        'ts', (bar.ts_ms || Date.now()).toString()
      ).catch((err: any) => logger.error({ err }, 'Failed to record fill'));

      logger.info({ id, price: fill.price, slip: fill.slip }, 'Order Filled in Paper Engine');
    }
  }
}

export async function startPaperExecutor(): Promise<void> {
  const redis = getRedis();
  await redis.xgroup('CREATE', SIGNAL_STREAM, CONSUMER_GROUP, '0', 'MKSTREAM').catch(() => {});
  await redis.xgroup('CREATE', 'spot:bars:1m', CONSUMER_GROUP + '_bars', '0', 'MKSTREAM').catch(() => {});
  
  logger.info('Paper Executor Started.');

  // 1. Consume Signals -> Create Pending Orders
  (async () => {
    while (true) {
      try {
        const res = await (redis as any).xreadgroup(
          'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
          'COUNT', 10,
          'BLOCK', 5000,
          'STREAMS', SIGNAL_STREAM, '>'
        );
        if (!res) continue;
        for (const [, msgs] of res) {
          for (const [id, fields] of msgs) {
            const sigData: Record<string, any> = {};
            for (let i = 0; i < fields.length; i += 2) {
              try {
                sigData[fields[i]] = JSON.parse(fields[i + 1]);
              } catch {
                sigData[fields[i]] = fields[i + 1];
              }
            }
            
            const entry = parseFloat(sigData.entry || '0');
            const sl = parseFloat(sigData.sl || '0');
            const tps = Array.isArray(sigData.tps) ? sigData.tps : [entry + 5, entry + 10];
            
            const plan: TradePlan = {
              dir: sigData.dir === 'SHORT' ? 'SHORT' : 'LONG',
              lot_size: 0.1,
              entry,
              sl,
              tps,
              risk_usd: 100,
              rr: 2.0,
              margin_req: 120,
              toxicity_estimate: 0.1,
              validation: { ok: true, errors: [] },
            };

            openOrders.set(id, { plan, signal: sigData as any, status: 'PENDING' });
            await redis.xack(SIGNAL_STREAM, CONSUMER_GROUP, id).catch(() => {});
          }
        }
      } catch (err) {
        logger.error({ err }, 'Signal Consumer Error in Paper Executor');
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  })();

  // 2. Consume 1m Bars -> Process Fills & Exits
  while (true) {
    try {
      const res = await (redis as any).xreadgroup(
        'GROUP', CONSUMER_GROUP + '_bars', CONSUMER_NAME + '_bar',
        'COUNT', 1,
        'BLOCK', 1000,
        'STREAMS', 'spot:bars:1m', '>'
      );
      if (res) {
        for (const [, msgs] of res) {
          for (const [msgId, fields] of msgs) {
            const barData: Record<string, any> = {};
            for (let i = 0; i < fields.length; i += 2) {
              barData[fields[i]] = fields[i + 1];
            }
            const bar = {
              bid_l: parseFloat(barData.bid_l || '0'),
              bid_h: parseFloat(barData.bid_h || '0'),
              ask_l: parseFloat(barData.ask_l || '0'),
              ask_h: parseFloat(barData.ask_h || '0'),
              spread_avg: parseFloat(barData.spread_avg || '0.3'),
              ts_ms: parseInt(barData.ts_ms || '0', 10),
            };
            await processBar(bar);
            await redis.xack('spot:bars:1m', CONSUMER_GROUP + '_bars', msgId).catch(() => {});
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Bar Processing Error in Paper Executor');
      await new Promise((r) => setTimeout(r, 1000));
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}
