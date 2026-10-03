// spot_engine/ts/core/structure_engine.ts
import pino from 'pino';
import { getRedis } from '../shared/redis_client';
import { 
  type SpotBar, 
  type StructureSignal 
} from '../../../shared/types';

const logger = pino({ name: 'StructureEngine' });

const BAR_STREAM = 'spot:bars:1m'; // Primary Signal TF
const SIGNAL_STREAM = 'spot:signals';
const CONSUMER_GROUP = 'structure_engine_group';
const CONSUMER_NAME = `structure-${process.pid}`;

// --- SMC Constants ---
const TTL_FVG_MS = 4 * 60 * 60 * 1000;
const TTL_OB_MS = 12 * 60 * 60 * 1000;

// --- State ---
interface FVG { top: number; bot: number; ts: number; mitigated: boolean; }
interface OB { top: number; bot: number; ts: number; mitigated: boolean; }

const barsBuffer: SpotBar[] = []; // Rolling Window (Last 500 bars)
const MAX_BUFFER = 1000;

let activeBullFVG: FVG | null = null;
let activeBearFVG: FVG | null = null;
let activeBullOB: OB | null = null;
let activeBearOB: OB | null = null;
let trend: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';

function detectFVG(bars: SpotBar[]): void {
  const i = bars.length - 1; // Current Closed Bar
  if (i < 2) return;
  const c0 = bars[i - 2];
  const c2 = bars[i];
  
  // Bullish FVG: Low[2] > High[0] (Gap between c0 and c2)
  if (c2.bid_l > c0.ask_h) {
    activeBullFVG = { top: c2.bid_l, bot: c0.ask_h, ts: c2.ts_ms, mitigated: false };
    logger.info({ top: activeBullFVG.top, bot: activeBullFVG.bot }, 'New Bullish FVG');
  }
  // Bearish FVG: High[2] < Low[0]
  if (c2.ask_h < c0.bid_l) {
    activeBearFVG = { top: c0.bid_l, bot: c2.ask_h, ts: c2.ts_ms, mitigated: false };
    logger.info({ top: activeBearFVG.top, bot: activeBearFVG.bot }, 'New Bearish FVG');
  }
}

function detectOB(bars: SpotBar[]): void {
  const i = bars.length - 1;
  if (i < 10) return;
  const cur = bars[i];
  const body = Math.abs(cur.mid_c - cur.mid_o);
  
  // Avg Body last 10
  let avgBody = 0;
  for (let k = i - 10; k < i; k++) {
    avgBody += Math.abs(bars[k].mid_c - bars[k].mid_o);
  }
  avgBody /= 10;
  
  if (cur.mid_c > cur.mid_o && body > avgBody * 1.5) { // Bullish Impulse
    // Find last Bearish Candle in lookback
    for (let j = i - 1; j >= i - 10; j--) {
      if (bars[j].mid_c < bars[j].mid_o) {
        activeBullOB = { top: bars[j].ask_h, bot: bars[j].bid_l, ts: bars[j].ts_ms, mitigated: false };
        break;
      }
    }
  } else if (cur.mid_c < cur.mid_o && body > avgBody * 1.5) { // Bearish Impulse
    for (let j = i - 1; j >= i - 10; j--) {
      if (bars[j].mid_c > bars[j].mid_o) {
        activeBearOB = { top: bars[j].ask_h, bot: bars[j].bid_l, ts: bars[j].ts_ms, mitigated: false };
        break;
      }
    }
  }
}

function checkMitigation(currentBar: SpotBar): void {
  const mid = currentBar.mid_c;
  const ts = currentBar.ts_ms;
  
  if (activeBullFVG && !activeBullFVG.mitigated) {
    if (mid < activeBullFVG.top || ts - activeBullFVG.ts > TTL_FVG_MS) activeBullFVG.mitigated = true;
  }
  if (activeBearFVG && !activeBearFVG.mitigated) {
    if (mid > activeBearFVG.bot || ts - activeBearFVG.ts > TTL_FVG_MS) activeBearFVG.mitigated = true;
  }
  if (activeBullOB && !activeBullOB.mitigated) {
    const eq = (activeBullOB.top + activeBullOB.bot) / 2;
    if (mid < eq || ts - activeBullOB.ts > TTL_OB_MS) activeBullOB.mitigated = true;
  }
  if (activeBearOB && !activeBearOB.mitigated) {
    const eq = (activeBearOB.top + activeBearOB.bot) / 2;
    if (mid > eq || ts - activeBearOB.ts > TTL_OB_MS) activeBearOB.mitigated = true;
  }
}

function tryGenerateSignal(bar: SpotBar): StructureSignal | null {
  const bid = bar.bid_c;
  const ask = bar.ask_c;
  const atrVal = bar.mid_h - bar.mid_l; // Proxy for instant ATR
  
  if (barsBuffer.length >= 20) {
    const fast = barsBuffer.slice(-5).reduce((s, b) => s + b.mid_c, 0) / 5;
    const slow = barsBuffer.slice(-20).reduce((s, b) => s + b.mid_c, 0) / 20;
    trend = fast > slow ? 'UP' : fast < slow ? 'DOWN' : 'FLAT';
  }

  if (trend === 'UP') {
    // Long: Pullback to Fresh Bull FVG or OB
    if (activeBullFVG && !activeBullFVG.mitigated && bid <= activeBullFVG.top && bid >= activeBullFVG.bot) {
      return buildSignal('LONG', 'FVG', bid, activeBullFVG.bot - atrVal * 0.1, bar.ts_ms);
    }
    if (activeBullOB && !activeBullOB.mitigated && bid <= activeBullOB.top && bid >= activeBullOB.bot) {
      const entry = (activeBullOB.top + activeBullOB.bot) / 2;
      return buildSignal('LONG', 'OB', entry, activeBullOB.bot - atrVal * 0.1, bar.ts_ms);
    }
  } else if (trend === 'DOWN') {
    // Short: Pullback to Fresh Bear FVG or OB
    if (activeBearFVG && !activeBearFVG.mitigated && ask >= activeBearFVG.bot && ask <= activeBearFVG.top) {
      return buildSignal('SHORT', 'FVG', ask, activeBearFVG.top + atrVal * 0.1, bar.ts_ms);
    }
    if (activeBearOB && !activeBearOB.mitigated && ask >= activeBearOB.bot && ask <= activeBearOB.top) {
      const entry = (activeBearOB.top + activeBearOB.bot) / 2;
      return buildSignal('SHORT', 'OB', entry, activeBearOB.top + atrVal * 0.1, bar.ts_ms);
    }
  }
  return null;
}

function buildSignal(dir: 'LONG' | 'SHORT', src: 'FVG' | 'OB', entry: number, sl: number, ts: number): StructureSignal {
  const tps = dir === 'LONG' 
    ? [entry + (entry - sl) * 2, entry + (entry - sl) * 3] 
    : [entry - (sl - entry) * 2, entry - (sl - entry) * 3];
  const ttl = src === 'FVG' ? TTL_FVG_MS : TTL_OB_MS;
  
  return {
    id: `sig_${ts}_${src}`,
    dir,
    entry,
    sl,
    tps,
    baseConfidence: 0.7,
    created_at: ts,
    expires_at: ts + ttl,
    half_life_ms: ttl / 2,
    source_structure: src,
  };
}

export async function startStructureEngine(): Promise<void> {
  const redis = getRedis();
  await redis.xgroup('CREATE', BAR_STREAM, CONSUMER_GROUP, '0', 'MKSTREAM').catch(() => {});
  
  logger.info('Structure Engine Started. Reading 1m Bars...');

  while (true) {
    try {
      const results = await (redis as any).xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'COUNT', 10,
        'BLOCK', 5000,
        'STREAMS', BAR_STREAM, '>'
      );
      if (!results) continue;

      for (const [, messages] of results) {
        for (const [msgId, fields] of messages) {
          const rawData: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            rawData[fields[i]] = fields[i + 1];
          }

          const bar: SpotBar = {
            ts: parseInt(rawData.ts || '0', 10),
            ts_ms: parseInt(rawData.ts_ms || '0', 10),
            bid_o: parseFloat(rawData.bid_o || '0'),
            bid_h: parseFloat(rawData.bid_h || '0'),
            bid_l: parseFloat(rawData.bid_l || '0'),
            bid_c: parseFloat(rawData.bid_c || '0'),
            ask_o: parseFloat(rawData.ask_o || '0'),
            ask_h: parseFloat(rawData.ask_h || '0'),
            ask_l: parseFloat(rawData.ask_l || '0'),
            ask_c: parseFloat(rawData.ask_c || '0'),
            mid_o: parseFloat(rawData.mid_o || '0'),
            mid_h: parseFloat(rawData.mid_h || '0'),
            mid_l: parseFloat(rawData.mid_l || '0'),
            mid_c: parseFloat(rawData.mid_c || '0'),
            spread_avg: parseFloat(rawData.spread_avg || '0'),
            spread_max: parseFloat(rawData.spread_max || '0'),
            spread_p90: parseFloat(rawData.spread_p90 || '0'),
            high_ts_offset_ms: parseInt(rawData.high_ts_offset_ms || '0', 10),
            low_ts_offset_ms: parseInt(rawData.low_ts_offset_ms || '0', 10),
            tick_count: parseInt(rawData.tick_count || '1', 10),
          };

          // 1. Buffer Management
          barsBuffer.push(bar);
          if (barsBuffer.length > MAX_BUFFER) barsBuffer.shift();
          
          // 2. Update Structures (Incremental)
          detectFVG(barsBuffer);
          detectOB(barsBuffer);
          
          // 3. Check Mitigation
          checkMitigation(bar);
          
          // 4. Generate Signal
          const signal = tryGenerateSignal(bar);
          if (signal) {
            await redis.xadd(
              SIGNAL_STREAM,
              '*',
              ...Object.entries(signal).flatMap(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v.toString()])
            );
            logger.info({ id: signal.id, dir: signal.dir, entry: signal.entry }, 'Signal Generated');
          }

          await redis.xack(BAR_STREAM, CONSUMER_GROUP, msgId);
        }
      }
    } catch (err) {
      logger.error({ err }, 'Structure Engine Loop Error');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
