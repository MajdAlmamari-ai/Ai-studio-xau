// spot_engine/ts/ingestion/tv_spot.ts
import WebSocket from 'ws';
import pino from 'pino';
import { getRedis } from '../shared/redis_client';
import { SpotTickSchema, type SpotTick } from '../../../shared/types';

const logger = pino({ name: 'TVSpotIngestion' });

const TV_WS_URL = process.env.TV_WS_ENDPOINT || 'wss://demo-tv-relay.gold-desk.internal/spot'; 
const RECONNECT_BASE_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let isShuttingDown = false;

const TICK_STREAM = 'spot:ticks'; // Redis Stream Key

function validateAndPushTick(data: any): boolean {
  const result = SpotTickSchema.safeParse(data);
  if (!result.success) {
    logger.warn({ errors: result.error.flatten(), data }, 'Invalid Tick Format');
    return false;
  }
  const tick: SpotTick = result.data;
  
  // Basic Sanity Checks
  if (tick.ask <= tick.bid) return false;
  if ((tick.ask - tick.bid) > 50) return false; // Spread > $50 spike filter
  if (tick.ts_ms < Date.now() - 60000) return false; // Stale > 1 min
  
  // Push to Redis Stream (Max Len ~ 1 Million ticks ~ few hours)
  getRedis().xadd(TICK_STREAM, '*', 
    'bid', tick.bid.toString(),
    'ask', tick.ask.toString(),
    'ts_ms', tick.ts_ms.toString(),
    'vol', (tick.vol ?? 1.0).toString()
  ).catch(err => logger.error({ err }, 'XADD Failed'));
  
  return true;
}

export function startTVIngestion(): Promise<void> {
  if (ws) return Promise.resolve();
  logger.info({ url: TV_WS_URL }, 'Starting TV Spot Ingestion...');

  return new Promise((resolve) => {
    const connect = () => {
      if (isShuttingDown) {
        resolve();
        return;
      }
      try {
        ws = new WebSocket(TV_WS_URL);

        ws.on('open', () => {
          logger.info('TV WebSocket Connected');
          reconnectAttempts = 0;
        });

        ws.on('message', (raw: Buffer) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.bid && msg.ask) validateAndPushTick(msg);
            else if (msg.d && Array.isArray(msg.d)) msg.d.forEach((d: any) => validateAndPushTick(d.v));
          } catch {
            logger.warn({ raw: raw.toString() }, 'Parse Error');
          }
        });

        ws.on('close', () => {
          logger.warn('TV WebSocket Closed. Reconnecting...');
          ws = null;
          scheduleReconnect();
        });

        ws.on('error', (err) => {
          logger.error({ err }, 'TV WebSocket Error');
          ws?.close();
        });
      } catch (err) {
        logger.error({ err }, 'Failed to initiate WebSocket');
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (isShuttingDown) {
        resolve();
        return;
      }
      const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
      reconnectAttempts++;
      setTimeout(connect, delay);
    };

    connect();
  });
}

export function stopTVIngestion(): void {
  isShuttingDown = true;
  ws?.close();
  ws = null;
}
