// execution/ts/interfaces/IBrokerAdapter.ts
import { TradePlan } from '../../../shared/types';

/** طلب أمر موحد للنظام */
export interface OrderRequest {
  clientOrderId: string;      // UUID فريد من Orchestrator (Idempotency Key)
  plan: TradePlan;            // الخطة المحسوبة (Lot, SL, TP, Entry)
  timestamp: number;          // وقت إنشاء الطلب
}

/** رد الوسيط الفوري */
export interface OrderResponse {
  success: boolean;
  brokerOrderId?: string;     // معرف الأمر في نظام الوسيط
  status: OrderStatus;
  message?: string;
  fills?: FillData[];         // إذا تم التنفيذ فوراً (Market)
}

/** حالة الأمر في دورة الحياة */
export type OrderStatus = 
  | 'NEW' 
  | 'SUBMITTED' 
  | 'PARTIALLY_FILLED' 
  | 'FILLED' 
  | 'CANCELLED' 
  | 'REJECTED' 
  | 'EXPIRED';

/** بيانات تعبئة (Fill) */
export interface FillData {
  fillId: string;
  price: number;
  volume: number;     // Lots
  timestamp: number;  // Epoch ms
  fee: number;        // Commission
  side: 'LONG' | 'SHORT';
}

/** تحديث حساب */
export interface AccountUpdate {
  equity: number;
  balance: number;
  freeMargin: number;
  usedMargin: number;
  positions: PositionData[];
  liveSpread: number;     // Current Spread for Symbol
  spreadAvg1h: number;    // 1h Average Spread
}

/** مركز مفتوح */
export interface PositionData {
  brokerPositionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  volume: number;         // Lots
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  swap: number;
  stopLoss?: number;
  takeProfit?: number;
}

/** ──────────────────────────────────────────────────────
 *  العقد الرئيسي: يجب تنفيذه لكل وسيط
 *  ────────────────────────────────────────────────────── */
export interface IBrokerAdapter {
  readonly brokerName: string;
  readonly isConnected: boolean;
  readonly symbol: string; // e.g., "XAU_USD" (OANDA) or "GOLD" (IBKR)

  /** تهيئة الاتصال (Auth, Streams) */
  connect(): Promise<void>;
  
  /** قطع الاتصال النظيف */
  disconnect(): Promise<void>;

  /** إرسال أمر جديد (Market / Limit / Stop) */
  sendOrder(request: OrderRequest): Promise<OrderResponse>;

  /** تعديل أمر معلق (SL/TP/Price) */
  modifyOrder(brokerOrderId: string, newSl?: number, newTp?: number, newPrice?: number): Promise<OrderResponse>;

  /** إلغاء أمر معلق */
  cancelOrder(brokerOrderId: string): Promise<OrderResponse>;

  /** استعلام حالة أمر محدد */
  getOrderStatus(brokerOrderId: string): Promise<OrderStatus>;

  /** الحصول على بيانات الحساب الحالية (Snapshot) */
  getAccountSnapshot(): Promise<AccountUpdate>;

  /** الاشتراك في تحديثات الأسعار/الحساب الفورية (WebSocket/Stream) */
  subscribeMarketData(callback: (tick: {bid: number, ask: number, ts: number}) => void): Promise<void>;
  subscribeAccountEvents(callback: (update: Partial<AccountUpdate>) => void): Promise<void>;

  /** تحويل رمز النظام إلى رمز الوسيط */
  normalizeSymbol(systemSymbol: string): string;
  denormalizeSymbol(brokerSymbol: string): string;
}
