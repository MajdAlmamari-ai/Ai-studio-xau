// execution/ts/adapters/OandaAdapter.ts
import pino from 'pino';
import WebSocket from 'ws';
import { 
  IBrokerAdapter, OrderRequest, OrderResponse, OrderStatus, 
  FillData, AccountUpdate, PositionData 
} from '../interfaces/IBrokerAdapter';

const logger = pino({ name: 'OandaAdapter' });

// ──────────────────────────────────────────────────────────────────────────────
// CONFIG & TYPES
// ──────────────────────────────────────────────────────────────────────────────

const OANDA_REST_URL = process.env.OANDA_ENV === 'live' 
  ? 'https://api-fxtrade.oanda.com/v3' 
  : 'https://api-fxpractice.oanda.com/v3';
const OANDA_STREAM_URL = process.env.OANDA_ENV === 'live'
  ? 'wss://stream-fxtrade.oanda.com/v3'
  : 'wss://stream-fxpractice.oanda.com/v3';

const ACCESS_TOKEN = process.env.OANDA_TOKEN || '';
const ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID || '';
const SYMBOL_MAP: Record<string, string> = { 'XAUUSD': 'XAU_USD' }; // System -> OANDA

interface OandaOrderRequest {
  order: {
    type: 'MARKET' | 'LIMIT' | 'STOP' | 'MARKET_IF_TOUCHED';
    instrument: string;
    units: string;           // Positive for Long, Negative for Short
    price?: string;          // For Limit/Stop
    priceBound?: string;     // Max slippage for Market
    timeInForce: 'FOK' | 'IOC' | 'GTC' | 'GTD' | 'GFD';
    gtdTime?: string;
    stopLossOnFill?: { price: string; timeInForce: 'GTC' };
    takeProfitOnFill?: { price: string; timeInForce: 'GTC' };
    clientExtensions?: { id: string; tag: string; comment: string };
  };
}

interface OandaAccount {
  id: string;
  balance: string;
  unrealizedPL: string;
  marginUsed: string;
  marginAvailable: string;
  openPositionCount: number;
  positions: OandaPosition[];
}

interface OandaPosition {
  instrument: string;
  long: { units: string; averagePrice: string; unrealizedPL: string; tradeIDs: string[] } | null;
  short: { units: string; averagePrice: string; unrealizedPL: string; tradeIDs: string[] } | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// ADAPTER CLASS
// ──────────────────────────────────────────────────────────────────────────────

export class OandaAdapter implements IBrokerAdapter {
  readonly brokerName = 'OANDA v20';
  readonly symbol = 'XAUUSD';
  isConnected = false;
  
  private ws: WebSocket | null = null;
  private priceCallback?: (tick: {bid: number, ask: number, ts: number}) => void;
  private accountCallback?: (update: Partial<AccountUpdate>) => void;
  private reconnectAttempts = 0;

  // ────────────────── LIFECYCLE ──────────────────

  async connect(): Promise<void> {
    if (!ACCESS_TOKEN || !ACCOUNT_ID) {
      logger.warn('OANDA_TOKEN / OANDA_ACCOUNT_ID missing in env; OANDA adapter in dry-run mode');
      this.isConnected = true;
      return;
    }
    
    try {
      // 1. Test REST Connection
      await this.restRequest('GET', `/accounts/${ACCOUNT_ID}/summary`);
      
      // 2. Connect Streaming (Pricing + Account Updates)
      await this.connectStream();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info({ account: ACCOUNT_ID }, '✅ OANDA Connected (REST + Stream)');
    } catch (err: any) {
      logger.error({ err: err?.message || err }, 'OANDA connection error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.ws?.close();
    this.ws = null;
    logger.info('OANDA Disconnected');
  }

  // ────────────────── ORDER MANAGEMENT ──────────────────

  async sendOrder(req: OrderRequest): Promise<OrderResponse> {
    const { clientOrderId, plan } = req;
    const oandaUnits = (plan.dir === 'LONG' ? 1 : -1) * Math.round(plan.lot_size * 100); 

    const body: OandaOrderRequest = {
      order: {
        type: plan.entryType === 'MARKET' ? 'MARKET' : (plan.dir === 'LONG' ? 'LIMIT' : 'STOP'),
        instrument: SYMBOL_MAP[this.symbol] || 'XAU_USD',
        units: oandaUnits.toString(),
        timeInForce: 'FOK',
      }
    };

    if (plan.entryType !== 'MARKET') {
      body.order.price = plan.entry.toFixed(2);
      body.order.timeInForce = 'GTC';
    }

    if (plan.sl > 0) {
      body.order.stopLossOnFill = { price: plan.sl.toFixed(2), timeInForce: 'GTC' };
    }
    if (plan.tps && plan.tps[0] > 0) {
      body.order.takeProfitOnFill = { price: plan.tps[0].toFixed(2), timeInForce: 'GTC' };
    }

    body.order.clientExtensions = {
      id: clientOrderId,
      tag: 'GoldDeskQuant',
      comment: `SL:${plan.sl} TP:${plan.tps.join(',')}`
    };

    try {
      const res = await this.restRequest('POST', `/accounts/${ACCOUNT_ID}/orders`, body);
      const orderFill = res.orderFillTransaction || res.orderCreateTransaction;
      
      if (res.orderRejectTransaction) {
        return { 
          success: false, 
          status: 'REJECTED', 
          message: res.orderRejectTransaction.rejectReason, 
          brokerOrderId: res.orderRejectTransaction.id 
        };
      }

      const brokerId = orderFill?.id || res.lastTransactionID;
      const fills: FillData[] = [];
      if (orderFill && orderFill.type === 'ORDER_FILL') {
        fills.push({
          fillId: orderFill.id,
          price: parseFloat(orderFill.price),
          volume: Math.abs(parseFloat(orderFill.units)) / 100,
          timestamp: new Date(orderFill.time).getTime(),
          fee: parseFloat(orderFill.commission || '0'),
          side: plan.dir
        });
      }

      return {
        success: true,
        brokerOrderId: brokerId,
        status: fills.length > 0 ? 'FILLED' : 'SUBMITTED',
        fills
      };
    } catch (e: any) {
      logger.error({ e: e?.message || e, clientOrderId }, 'Send Order Failed');
      return { success: false, status: 'REJECTED', message: e?.message || String(e) };
    }
  }

  async modifyOrder(_brokerOrderId: string, _newSl?: number, _newTp?: number, _newPrice?: number): Promise<OrderResponse> {
    return { success: false, status: 'REJECTED', message: 'Modify requires TradeID mapping logic' };
  }

  async cancelOrder(brokerOrderId: string): Promise<OrderResponse> {
    try {
      await this.restRequest('PUT', `/accounts/${ACCOUNT_ID}/orders/${brokerOrderId}/cancel`);
      return { success: true, brokerOrderId, status: 'CANCELLED' };
    } catch (e: any) { 
      return { success: false, status: 'REJECTED', message: e?.message || String(e) }; 
    }
  }

  async getOrderStatus(_brokerOrderId: string): Promise<OrderStatus> {
    return 'SUBMITTED';
  }

  // ────────────────── ACCOUNT & MARKET DATA ──────────────────

  async getAccountSnapshot(): Promise<AccountUpdate> {
    try {
      const res = await this.restRequest('GET', `/accounts/${ACCOUNT_ID}/summary`);
      const acc = res.account as OandaAccount;
      
      const positions: PositionData[] = [];
      if (acc.positions) {
        for (const p of acc.positions) {
          if (p.long && parseFloat(p.long.units) > 0) {
            positions.push(this.mapPosition('LONG', p.long, p.instrument));
          }
          if (p.short && parseFloat(p.short.units) > 0) {
            positions.push(this.mapPosition('SHORT', p.short, p.instrument));
          }
        }
      }

      return {
        equity: parseFloat(acc.balance) + parseFloat(acc.unrealizedPL || '0'),
        balance: parseFloat(acc.balance),
        freeMargin: parseFloat(acc.marginAvailable || acc.balance),
        usedMargin: parseFloat(acc.marginUsed || '0'),
        positions,
        liveSpread: 0.3,
        spreadAvg1h: 0.3
      };
    } catch {
      return {
        equity: 100000,
        balance: 100000,
        freeMargin: 100000,
        usedMargin: 0,
        positions: [],
        liveSpread: 0.3,
        spreadAvg1h: 0.3
      };
    }
  }

  private mapPosition(side: 'LONG' | 'SHORT', data: any, instrument: string): PositionData {
    return {
      brokerPositionId: data.tradeIDs?.[0] || 'pos_0',
      symbol: this.denormalizeSymbol(instrument),
      side,
      volume: Math.abs(parseFloat(data.units)) / 100,
      entryPrice: parseFloat(data.averagePrice),
      currentPrice: parseFloat(data.averagePrice),
      unrealizedPnl: parseFloat(data.unrealizedPL || '0'),
      swap: 0,
    };
  }

  // ────────────────── STREAMING (WebSocket) ──────────────────

  private async connectStream(): Promise<void> {
    const url = `${OANDA_STREAM_URL}/accounts/${ACCOUNT_ID}/pricing/stream?instruments=${SYMBOL_MAP[this.symbol] || 'XAU_USD'}`;
    this.ws = new WebSocket(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });

    this.ws.on('open', () => logger.info('OANDA Stream Connected'));
    this.ws.on('error', (err) => logger.error({ err }, 'OANDA Stream Error'));
    this.ws.on('close', () => { this.isConnected = false; this.scheduleReconnect(); });

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'PRICE') this.handlePrice(msg);
        else if (msg.type === 'ACCOUNT_UPDATE') this.handleAccountUpdate(msg);
      } catch {
        logger.warn({ data: data.toString() }, 'Stream Parse Error');
      }
    });
  }

  private handlePrice(msg: any): void {
    if (msg.bids?.[0] && msg.asks?.[0]) {
      const tick = {
        bid: parseFloat(msg.bids[0].price),
        ask: parseFloat(msg.asks[0].price),
        ts: new Date(msg.time).getTime()
      };
      this.priceCallback?.(tick);
    }
  }

  private handleAccountUpdate(msg: any): void {
    this.accountCallback?.({
      equity: msg.equity ? parseFloat(msg.equity) : undefined,
      balance: msg.balance ? parseFloat(msg.balance) : undefined,
    });
  }

  subscribeMarketData(cb: (tick: {bid: number, ask: number, ts: number}) => void): Promise<void> {
    this.priceCallback = cb; 
    return Promise.resolve();
  }
  
  subscribeAccountEvents(cb: (update: Partial<AccountUpdate>) => void): Promise<void> {
    this.accountCallback = cb; 
    return Promise.resolve();
  }

  // ────────────────── HELPERS ──────────────────

  private async restRequest(method: string, endpoint: string, body?: any): Promise<any> {
    const res = await fetch(`${OANDA_REST_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept-Datetime-Format': 'RFC3339'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err: any = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`OANDA ${res.status}: ${err.errorMessage || JSON.stringify(err)}`);
    }
    return res.json();
  }

  normalizeSymbol(sys: string): string { return SYMBOL_MAP[sys] || sys; }
  denormalizeSymbol(broker: string): string { 
    const rev = Object.fromEntries(Object.entries(SYMBOL_MAP).map(([k, v]) => [v, k]));
    return rev[broker] || broker; 
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts++ < 10) setTimeout(() => this.connectStream(), 5000);
  }
}
