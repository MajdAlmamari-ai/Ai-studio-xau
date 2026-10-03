// execution/ts/adapters/PaperAdapter.ts
import { 
  IBrokerAdapter, OrderRequest, OrderResponse, OrderStatus, 
  AccountUpdate, FillData 
} from '../interfaces/IBrokerAdapter';
import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ name: 'PaperAdapter' });

export class PaperAdapter implements IBrokerAdapter {
  readonly brokerName = 'PAPER (Simulator)';
  readonly symbol = 'XAUUSD';
  isConnected = false;
  
  private emitter = new EventEmitter();
  private price = 2650.0;
  private spread = 0.3;
  private equity = 100000;
  private balance = 100000;
  private usedMargin = 0;
  private positions: any[] = [];
  private priceTimer?: NodeJS.Timeout;

  async connect(): Promise<void> {
    this.isConnected = true;
    this.price = 2650.0;
    this.equity = 100000;
    this.balance = 100000;
    this.usedMargin = 0;
    this.positions = [];
    
    // Simulate Price Movement
    this.priceTimer = setInterval(() => {
      this.price += (Math.random() - 0.5) * 0.2;
      this.spread = 0.2 + Math.random() * 0.2;
      this.emitter.emit('tick', { 
        bid: this.price - this.spread / 2, 
        ask: this.price + this.spread / 2, 
        ts: Date.now() 
      });
    }, 1000);
    
    logger.info('Paper Adapter Connected (Simulator Running)');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    if (this.priceTimer) clearInterval(this.priceTimer);
    this.emitter.removeAllListeners();
  }

  async sendOrder(req: OrderRequest): Promise<OrderResponse> {
    const { clientOrderId, plan } = req;
    logger.info({ id: clientOrderId, dir: plan.dir, lot: plan.lot_size }, 'PAPER ORDER RECEIVED');

    const fillPrice = plan.dir === 'LONG' ? this.price + this.spread / 2 : this.price - this.spread / 2;
    const slippage = (Math.random() - 0.5) * 0.1;
    const finalPrice = plan.dir === 'LONG' ? fillPrice + slippage : fillPrice - slippage;

    const fill: FillData = {
      fillId: `paper_${Date.now()}`,
      price: finalPrice,
      volume: plan.lot_size,
      timestamp: Date.now(),
      fee: plan.lot_size * 0.7,
      side: plan.dir
    };

    this.usedMargin += (plan.lot_size * 100 * finalPrice) / 20;
    this.positions.push({ 
      id: clientOrderId, 
      dir: plan.dir, 
      vol: plan.lot_size, 
      entry: finalPrice, 
      sl: plan.sl, 
      tp: plan.tps ? plan.tps[0] : 0 
    });

    return {
      success: true,
      brokerOrderId: clientOrderId,
      status: 'FILLED',
      fills: [fill]
    };
  }

  async modifyOrder(id: string, sl?: number, tp?: number): Promise<OrderResponse> {
    const pos = this.positions.find((p) => p.id === id);
    if (pos) { 
      if (sl) pos.sl = sl; 
      if (tp) pos.tp = tp; 
    }
    return { success: true, brokerOrderId: id, status: 'SUBMITTED' };
  }

  async cancelOrder(id: string): Promise<OrderResponse> {
    this.positions = this.positions.filter((p) => p.id !== id);
    return { success: true, brokerOrderId: id, status: 'CANCELLED' };
  }

  async getOrderStatus(id: string): Promise<OrderStatus> {
    return this.positions.find((p) => p.id === id) ? 'FILLED' : 'CANCELLED';
  }

  async getAccountSnapshot(): Promise<AccountUpdate> {
    let uPnl = 0;
    for (const p of this.positions) {
      const curPx = this.price;
      const diff = p.dir === 'LONG' ? curPx - p.entry : p.entry - curPx;
      uPnl += diff * p.vol * 100;
    }
    this.equity = this.balance + uPnl;

    return {
      equity: this.equity,
      balance: this.balance,
      freeMargin: Math.max(0, this.equity - this.usedMargin),
      usedMargin: this.usedMargin,
      positions: this.positions.map((p) => ({ ...p, unrealizedPnl: 0 })),
      liveSpread: this.spread,
      spreadAvg1h: this.spread
    };
  }

  subscribeMarketData(cb: (tick: any) => void): Promise<void> {
    this.emitter.on('tick', cb); 
    return Promise.resolve();
  }
  
  subscribeAccountEvents(_cb: (update: any) => void): Promise<void> { 
    return Promise.resolve(); 
  }
  
  normalizeSymbol(s: string): string { return s; }
  denormalizeSymbol(s: string): string { return s; }
}
