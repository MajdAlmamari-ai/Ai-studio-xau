// spot_engine/ts/core/bar_aggregator.ts
import pino from 'pino';
import { getRedis } from '../shared/redis_client';
import { SpotBarSchema, type SpotBar, type SpotTick } from '../../../shared/types';

const logger = pino({ name: 'BarAggregator' });

const TICK_STREAM = 'spot:ticks';
const BAR_STREAM_PREFIX = 'spot:bars:'; // spot:bars:1m, spot:bars:5m, etc.
const CONSUMER_GROUP = 'bar_aggregator_group';
const CONSUMER_NAME = `aggregator-${process.pid}`;

const TIMEFRAMES_MS = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1H': 3_600_000,
  '4H': 14_400_000,
};

type TFKey = keyof typeof TIMEFRAMES_MS;

interface BarState {
  bucketStart: number;
  bucketEnd: number;
  bid_o: number; bid_h: number; bid_l: number; bid_c: number;
  ask_o: number; ask_h: number; ask_l: number; ask_c: number;
  mid_o: number; mid_h: number; mid_l: number; mid_c: number;
  spreadSum: number; spreadMax: number; spreadArr: number[];
  highTsOffset: number; lowTsOffset: number;
  tickCount: number;
  firstTickTs: number;
}

const states: Map<TFKey, BarState> = new Map();

function initState(tf: TFKey, tick: SpotTick): BarState {
  const tfMs = TIMEFRAMES_MS[tf];
  const bucketStart = Math.floor(tick.ts_ms / tfMs) * tfMs;
  const mid = (tick.bid + tick.ask) / 2;
  const spread = tick.ask - tick.bid;
  return {
    bucketStart, bucketEnd: bucketStart + tfMs,
    bid_o: tick.bid, bid_h: tick.bid, bid_l: tick.bid, bid_c: tick.bid,
    ask_o: tick.ask, ask_h: tick.ask, ask_l: tick.ask, ask_c: tick.ask,
    mid_o: mid, mid_h: mid, mid_l: mid, mid_c: mid,
    spreadSum: spread, spreadMax: spread, spreadArr: [spread],
    highTsOffset: 0, lowTsOffset: 0,
    tickCount: 1, firstTickTs: tick.ts_ms,
  };
}

function updateState(state: BarState, tick: SpotTick): void {
  const mid = (tick.bid + tick.ask) / 2;
  const spread = tick.ask - tick.bid;
  const offset = tick.ts_ms - state.bucketStart;

  // Bid OHLC
  if (tick.bid > state.bid_h) { state.bid_h = tick.bid; state.highTsOffset = offset; }
  if (tick.bid < state.bid_l) { state.bid_l = tick.bid; state.lowTsOffset = offset; }
  state.bid_c = tick.bid;

  // Ask OHLC
  if (tick.ask > state.ask_h) state.ask_h = tick.ask;
  if (tick.ask < state.ask_l) state.ask_l = tick.ask;
  state.ask_c = tick.ask;

  // Mid OHLC
  if (mid > state.mid_h) state.mid_h = mid;
  if (mid < state.mid_l) state.mid_l = mid;
  state.mid_c = mid;

  // Spread Stats
  state.spreadSum += spread;
  if (spread > state.spreadMax) state.spreadMax = spread;
  state.spreadArr.push(spread);

  state.tickCount++;
}

function finalizeBar(_tf: TFKey, state: BarState): SpotBar {
  const spreadArr = state.spreadArr.sort((a, b) => a - b);
  const p90Idx = Math.min(spreadArr.length - 1, Math.ceil(spreadArr.length * 0.9) - 1);
  
  return {
    ts: Math.floor(state.bucketStart / 1000),
    ts_ms: state.bucketStart,
    bid_o: state.bid_o, bid_h: state.bid_h, bid_l: state.bid_l, bid_c: state.bid_c,
    ask_o: state.ask_o, ask_h: state.ask_h, ask_l: state.ask_l, ask_c: state.ask_c,
    mid_o: state.mid_o, mid_h: state.mid_h, mid_l: state.mid_l, mid_c: state.mid_c,
    spread_avg: state.spreadSum / state.tickCount,
    spread_max: state.spreadMax,
    spread_p90: spreadArr[p90Idx] || 0,
    high_ts_offset_ms: state.highTsOffset,
    low_ts_offset_ms: state.lowTsOffset,
    tick_count: state.tickCount,
  };
}

async function publishBar(tf: TFKey, bar: SpotBar): Promise<void> {
  const streamKey = `${BAR_STREAM_PREFIX}${tf}`;
  const redis = getRedis();
  const parsed = SpotBarSchema.safeParse(bar);
  if (!parsed.success) {
    logger.error({ errors: parsed.error.flatten() }, 'Invalid Bar Generated');
    return;
  }
  await redis.xadd(streamKey, 'MAXLEN', '~', '100000', '*', 
    ...Object.entries(bar).flatMap(([k, v]) => [k, v.toString()])
  );
}

export async function startBarAggregator(): Promise<void> {
  const redis = getRedis();
  
  for (const tf of Object.keys(TIMEFRAMES_MS) as TFKey[]) {
    await redis.xgroup('CREATE', TICK_STREAM, CONSUMER_GROUP, '0', 'MKSTREAM').catch(() => {});
  }

  logger.info('Bar Aggregator Started. Reading from spot:ticks');

  while (true) {
    try {
      const results = await (redis as any).xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'COUNT', 100,
        'BLOCK', 5000,
        'STREAMS', TICK_STREAM, '>'
      );
      
      if (!results) continue;

      for (const [, messages] of results) {
        for (const [msgId, fields] of messages) {
          const tickData: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            tickData[fields[i]] = fields[i + 1];
          }

          const tick: SpotTick = {
            bid: parseFloat(tickData.bid || '0'),
            ask: parseFloat(tickData.ask || '0'),
            ts_ms: parseInt(tickData.ts_ms || '0', 10),
            vol: parseFloat(tickData.vol || '1'),
          };

          for (const tf of Object.keys(TIMEFRAMES_MS) as TFKey[]) {
            let state = states.get(tf);
            
            if (state && tick.ts_ms >= state.bucketEnd) {
              const closedBar = finalizeBar(tf, state);
              await publishBar(tf, closedBar);
              
              state = initState(tf, tick);
              states.set(tf, state);
            } else if (!state) {
              state = initState(tf, tick);
              states.set(tf, state);
            } else {
              updateState(state, tick);
            }
          }
          
          await redis.xack(TICK_STREAM, CONSUMER_GROUP, msgId).catch(() => {});
        }
      }
    } catch (err) {
      logger.error({ err }, 'Aggregator Loop Error');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
