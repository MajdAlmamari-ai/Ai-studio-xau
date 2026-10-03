// execution/ts/state/OrderStateMachine.ts
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { 
  IBrokerAdapter, OrderRequest, OrderResponse, OrderStatus, FillData 
} from '../interfaces/IBrokerAdapter';
import { TradePlan, ExecutionDecision } from '../../../shared/types';

const logger = pino({ name: 'OrderFSM' });

// ──────────────────────────────────────────────────────────────────────────────
// ORDER STATE DEFINITION
// ──────────────────────────────────────────────────────────────────────────────

export interface ManagedOrder {
  id: string;                 // Internal UUID (ClientOrderId)
  brokerId?: string;          // Broker Order ID
  plan: TradePlan;
  decision: ExecutionDecision;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  fills: FillData[];
  avgFillPrice: number;
  totalVolume: number;
  retryCount: number;
  error?: string;
}

type OrderEvent = 
  | { type: 'SUBMIT'; request: OrderRequest }
  | { type: 'ACK'; response: OrderResponse }
  | { type: 'FILL'; fill: FillData }
  | { type: 'REJECT'; reason: string }
  | { type: 'CANCEL_ACK' }
  | { type: 'TIMEOUT' }
  | { type: 'MANUAL_CANCEL' };

// ──────────────────────────────────────────────────────────────────────────────
// STATE MACHINE LOGIC
// ──────────────────────────────────────────────────────────────────────────────

export class OrderStateMachine {
  private orders: Map<string, ManagedOrder> = new Map();
  private adapter: IBrokerAdapter;
  private onFillCallback?: (order: ManagedOrder, fill: FillData) => Promise<void>;
  private onStatusChangeCallback?: (order: ManagedOrder) => Promise<void>;

  constructor(adapter: IBrokerAdapter) {
    this.adapter = adapter;
  }

  setCallbacks(
    onFill: (o: ManagedOrder, f: FillData) => Promise<void>, 
    onStatus: (o: ManagedOrder) => Promise<void>
  ) {
    this.onFillCallback = onFill;
    this.onStatusChangeCallback = onStatus;
  }

  // ────────────────── PUBLIC API ──────────────────

  async submit(decision: ExecutionDecision): Promise<ManagedOrder> {
    if (!decision.plan) throw new Error('No Plan in Decision');
    
    const clientOrderId = decision.plan.id || uuidv4();
    const request: OrderRequest = { clientOrderId, plan: decision.plan, timestamp: Date.now() };

    const order: ManagedOrder = {
      id: clientOrderId,
      plan: decision.plan,
      decision,
      status: 'NEW',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fills: [],
      avgFillPrice: 0,
      totalVolume: 0,
      retryCount: 0,
    };
    this.orders.set(clientOrderId, order);

    await this.processEvent(order, { type: 'SUBMIT', request });
    return order;
  }

  async cancel(clientOrderId: string): Promise<void> {
    const order = this.orders.get(clientOrderId);
    if (!order || !order.brokerId) return;
    if (['FILLED', 'CANCELLED', 'REJECTED'].includes(order.status)) return;

    try {
      await this.adapter.cancelOrder(order.brokerId);
    } catch (e: any) { 
      logger.error({ e: e?.message || e, id: clientOrderId }, 'Cancel Failed'); 
    }
  }

  // ────────────────── EVENT PROCESSING (FSM Core) ──────────────────

  async handleBrokerResponse(response: OrderResponse): Promise<void> {
    if (!response.brokerOrderId) return;
    const order = this.orders.get(response.brokerOrderId);
    if (order) {
      await this.processEvent(order, { type: 'ACK', response });
    }
  }

  async handleFill(fill: FillData): Promise<void> {
    for (const order of this.orders.values()) {
      if (order.brokerId && order.status !== 'FILLED') {
        await this.processEvent(order, { type: 'FILL', fill });
        break;
      }
    }
  }

  private async processEvent(order: ManagedOrder, event: OrderEvent): Promise<void> {
    const prevStatus = order.status;
    let nextStatus = order.status;

    switch (event.type) {
      case 'SUBMIT':
        try {
          const response = await this.adapter.sendOrder(event.request);
          order.brokerId = response.brokerOrderId;
          if (response.success) {
            nextStatus = response.fills?.length ? 'FILLED' : 'SUBMITTED';
            if (response.fills) {
              for (const fill of response.fills) {
                await this.applyFill(order, fill);
              }
            }
          } else {
            nextStatus = 'REJECTED';
            order.error = response.message;
          }
        } catch (e: any) {
          nextStatus = 'REJECTED';
          order.error = e.message;
        }
        break;

      case 'FILL':
        await this.applyFill(order, event.fill);
        nextStatus = order.totalVolume >= order.plan.lot_size ? 'FILLED' : 'PARTIALLY_FILLED';
        if (this.onFillCallback) await this.onFillCallback(order, event.fill);
        break;

      case 'REJECT':
        nextStatus = 'REJECTED';
        order.error = event.reason;
        break;
      
      case 'CANCEL_ACK':
        nextStatus = 'CANCELLED';
        break;
    }

    if (nextStatus !== prevStatus) {
      order.status = nextStatus;
      order.updatedAt = Date.now();
      logger.info({ id: order.id, from: prevStatus, to: nextStatus, vol: order.totalVolume }, 'Order State Transition');
      if (this.onStatusChangeCallback) await this.onStatusChangeCallback(order);
    }
  }

  private async applyFill(order: ManagedOrder, fill: FillData): Promise<void> {
    order.fills.push(fill);
    order.totalVolume += fill.volume;
    order.avgFillPrice = order.fills.reduce((sum, f) => sum + f.price * f.volume, 0) / order.totalVolume;
  }

  // ────────────────── QUERIES ──────────────────

  getOrder(clientOrderId: string): ManagedOrder | undefined {
    return this.orders.get(clientOrderId);
  }

  getOpenOrders(): ManagedOrder[] {
    return Array.from(this.orders.values()).filter((o) => 
      ['NEW', 'SUBMITTED', 'PARTIALLY_FILLED'].includes(o.status)
    );
  }
}
