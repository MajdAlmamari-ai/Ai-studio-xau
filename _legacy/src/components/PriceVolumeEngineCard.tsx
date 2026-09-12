import React, { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  Layers,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Server,
  Radio,
  Sliders,
  BarChart3,
  Clock,
  Gauge
} from 'lucide-react';
import { PriceVolumeEngineState, ExchangeSource } from '../types';

interface PriceVolumeEngineCardProps {
  initialState?: PriceVolumeEngineState;
  onRefreshTrigger?: () => void;
}

export const PriceVolumeEngineCard: React.FC<PriceVolumeEngineCardProps> = () => {
  const [engineState, setEngineState] = useState<PriceVolumeEngineState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Poll Engine status every 1.5 seconds for real-time order flow experience
  useEffect(() => {
    let isMounted = true;

    const fetchEngineStatus = async () => {
      try {
        const res = await fetch('/api/engine/status');
        if (res.ok) {
          const data: PriceVolumeEngineState = await res.json();
          if (isMounted) {
            setEngineState(data);
            setIsLoading(false);
          }
        }
      } catch (err) {
        // Fallback quiet
      }
    };

    fetchEngineStatus();
    const interval = setInterval(fetchEngineStatus, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleManualSwitch = async (source: ExchangeSource) => {
    try {
      setIsSwitching(true);
      const res = await fetch('/api/engine/switch-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setEngineState(data.state);
        setActionNotice(`تم تحويل المصدر النشط بنجاح إلى: ${source}`);
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (err: any) {
      setActionNotice(`خطأ في التحويل: ${err.message}`);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleRecalculateValue = async () => {
    try {
      setIsRecalculating(true);
      const res = await fetch('/api/engine/recalculate-value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setEngineState(data.state);
        setActionNotice('تمت إعادة حساب VWAP ومناطق القيمة (PoC/VAH/VAL) ومعايرة MGC*10 بنجاح.');
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (err: any) {
      setActionNotice(`خطأ في الحساب: ${err.message}`);
    } finally {
      setIsRecalculating(false);
    }
  };

  if (isLoading && !engineState) {
    return (
      <div className="bg-[#0D1017] border border-[#1A202C] rounded-2xl p-6 text-center text-gray-400 font-mono text-sm">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
        جاري تهيئة محرك الأسعار والأحجام اللحظي (Price & Volume Data Engine)...
      </div>
    );
  }

  const {
    activePrimarySource = 'BINANCE',
    medianPrice = 4478.50,
    syncedPrice = 4478.50,
    binancePrice = 4478.50,
    mgcPrice = 4479.20,
    basisSpread = 0.70,
    exchanges,
    cvd,
    calibration,
    volumeValueEngine,
    failoverEvents = [],
  } = engineState || {};

  const isCaution = calibration?.cautionMode;
  const isPositiveDelta = (cvd?.cumulativeDelta ?? 0) >= 0;

  return (
    <div className="bg-[#0B0E14] border border-[#1E2538] rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 font-sans">
      {/* 1. Header & Engine Architecture Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1E2538] pb-5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent border border-amber-500/30 text-amber-400 shadow-inner shrink-0">
            <Radio className="w-6 h-6 animate-pulse text-amber-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                محرك السعر والأحجام اللحظي (Price & Volume Data Engine)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                تدفق صفقات حي (Live Feed)
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Binance WebSocket Trades • Cumulative Volume Delta (CVD) • Rolling Basis Calibration • Multi-Exchange Failover • MGC*10 Anchored VWAP
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRecalculateValue}
            disabled={isRecalculating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#151924] hover:bg-[#1E2538] border border-[#273048] text-xs font-mono font-semibold text-zinc-300 transition active:scale-95 disabled:opacity-50"
            title="إعادة حساب ومحاذاة نقاط VWAP ومناطق القيمة PoC لآخر 5 دقائق"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span>تحديث مناطق القيمة (5m)</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 2. Caution Mode Banner (if divergence > 0.3%) */}
      {isCaution ? (
        <div className="bg-rose-500/10 border-2 border-rose-500/40 rounded-xl p-4 flex items-start gap-3.5 animate-pulse">
          <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold text-rose-300 text-sm flex items-center gap-2">
              <span>⚠️ تم تفعيل "وضع الحذر" التلقائي (Caution Mode Activated)</span>
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 font-mono text-[11px]">
                انحراف {calibration.divergencePct}% &gt; 0.3%
              </span>
            </div>
            <p className="text-gray-300 leading-relaxed">
              تم رصد تباعد سعري بين سعر Binance الفوري وسعر عقود الذهب المصغرة (MGC=F) يتجاوز النسبة الآمنة (0.3%). 
              قام النظام تلقائياً <strong className="text-white underline">بتخفيض حجم الصفقات بنسبة 50%</strong> لحماية رأس المال حتى استعادة التناغم السعري المؤسساتي.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-emerald-400 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>معايرة الانحراف السعري مستقرة تماماً: {calibration?.statusMessageAr}</span>
          </div>
          <span className="text-[11px] font-mono text-gray-400">
            الانحراف اللحظي: <strong className="text-emerald-300">{calibration?.divergencePct}%</strong> (الحد الأقصى: 0.3%)
          </span>
        </div>
      )}

      {/* 3. Core Price Confluence Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Synced Price */}
        <div className="bg-[#121622] border border-[#222A40] p-4 rounded-xl relative overflow-hidden group">
          <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
            <span>السعر المعاير المؤسساتي (Synced Price)</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400 tracking-tight">
            ${syncedPrice.toFixed(2)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1.5 flex items-center justify-between font-mono">
            <span>معامل التصحيح: {calibration?.rollingBasisRatio?.toFixed(5)}</span>
            <span className="text-amber-500 font-semibold">مؤطر بـ MGC</span>
          </div>
        </div>

        {/* Binance Feed Price */}
        <div className="bg-[#121622] border border-[#222A40] p-4 rounded-xl">
          <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
            <span>سعر بينانس المباشر (Binance PAXG)</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white tracking-tight">
            ${binancePrice.toFixed(2)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1.5 flex items-center justify-between font-mono">
            <span>تدفق الصفقات: aggTrade</span>
            <span className="text-emerald-400">بدون تأخير</span>
          </div>
        </div>

        {/* Median Price across active feeds */}
        <div className="bg-[#121622] border border-[#222A40] p-4 rounded-xl">
          <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
            <span>الوسيط السعري (Median Price)</span>
            <Sliders className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300 tracking-tight">
            ${medianPrice.toFixed(2)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1.5 flex items-center justify-between font-mono">
            <span>فلتر الشموع الوهمية</span>
            <span className="text-cyan-400 font-semibold">مفلتر الانزلاق</span>
          </div>
        </div>

        {/* MGC Futures Price */}
        <div className="bg-[#121622] border border-[#222A40] p-4 rounded-xl">
          <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
            <span>عقود الذهب المصغرة (MGC=F)</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black font-mono text-blue-300 tracking-tight">
            ${mgcPrice.toFixed(2)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1.5 flex items-center justify-between font-mono">
            <span>فارق البيسس (Basis):</span>
            <span className="text-blue-400 font-bold font-mono">
              {basisSpread >= 0 ? `+${basisSpread.toFixed(2)}` : basisSpread.toFixed(2)}$
            </span>
          </div>
        </div>
      </div>

      {/* 4. Real-time CVD & Order Flow Velocity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CVD Delta Monitor */}
        <div className="bg-[#10141E] border border-[#1E2538] rounded-xl p-4.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1E2538] pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold text-white">الدلتا التراكمية (Cumulative Volume Delta - CVD)</h4>
            </div>
            <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${isPositiveDelta ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {isPositiveDelta ? 'شراء عدواني صافي' : 'بيع عدواني صافي'}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div className="text-xs text-gray-400">قيمة الـ CVD الصافية:</div>
            <div className={`text-2xl font-black font-mono ${isPositiveDelta ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositiveDelta ? `+${(cvd?.cumulativeDelta ?? 0).toLocaleString('ar-EG')}` : (cvd?.cumulativeDelta ?? 0).toLocaleString('ar-EG')}{' '}
              <span className="text-xs font-normal text-gray-400 font-sans">أونصة</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
            <div className="p-2.5 rounded-lg bg-[#141926] border border-[#20273A]">
              <div className="text-gray-400 text-[11px] mb-1">حجم الشراء العدواني (Buy):</div>
              <div className="text-emerald-400 font-bold text-sm">+{cvd?.buyVolume?.toFixed(1)} oz</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#141926] border border-[#20273A]">
              <div className="text-gray-400 text-[11px] mb-1">حجم البيع العدواني (Sell):</div>
              <div className="text-rose-400 font-bold text-sm">-{cvd?.sellVolume?.toFixed(1)} oz</div>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 leading-relaxed">
            المعادلة اللحظية: <code className="text-amber-300 font-mono">Delta = Sum(Buy_Volume) - Sum(Sell_Volume)</code> محسوبة فور ورود الصفقات المباشرة.
          </div>
        </div>

        {/* Order Flow Speed & Tick Count Monitor */}
        <div className="bg-[#10141E] border border-[#1E2538] rounded-xl p-4.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1E2538] pb-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">سرعة التدفق وعدد التكات (Tick Velocity)</h4>
            </div>
            <span className="text-xs font-mono text-cyan-300 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
              {cvd?.tickVelocity} t/s
            </span>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">تقييم قوة وزخم التدفق:</span>
              <span className="font-bold text-amber-300 font-mono">{cvd?.orderFlowSpeedAr}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">إجمالي التكات المستلمة:</span>
              <span className="font-bold text-white font-mono">{(cvd?.tickCountTotal ?? 0).toLocaleString('ar-EG')} تيك</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">تكات الدقيقة الأخيرة:</span>
              <span className="font-bold text-cyan-400 font-mono">{cvd?.ticksLastMinute} تيك/دقيقة</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">تكات آخر 5 ثوانٍ:</span>
              <span className="font-bold text-emerald-400 font-mono">{cvd?.ticksLast5Sec} تيك</span>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 leading-relaxed border-t border-[#1E2538] pt-2">
            تم اعتماد <span className="text-white font-semibold">Tick Count</span> لقياس سرعة التنفيذ الحقيقية بدلاً من الحجم النقدي فقط لكشف اندفاعات صانع السوق.
          </div>
        </div>

        {/* Rolling Basis Calibration Metrics */}
        <div className="bg-[#10141E] border border-[#1E2538] rounded-xl p-4.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1E2538] pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-bold text-white">معايرة الانحراف (Rolling Basis 60m)</h4>
            </div>
            <span className="text-xs font-mono text-purple-300 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
              نافذة 60 دقيقة
            </span>
          </div>

          <div className="space-y-2 pt-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">متوسط النسبة (Rolling Ratio):</span>
              <span className="font-bold text-purple-300 font-mono">{calibration?.rollingBasisRatio}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">عدد عينات النافذة الدوارة:</span>
              <span className="font-bold text-white font-mono">{calibration?.sampleCount} عينة</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">نسبة الانحراف اللحظي:</span>
              <span className={`font-bold font-mono ${calibration?.divergencePct > 0.3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {calibration?.divergencePct}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">معامل حجم العقد المفعل:</span>
              <span className="font-bold text-amber-400 font-mono">
                {calibration?.positionSizeMultiplier === 0.5 ? '50% (مخفض لوضع الحذر)' : '100% (حجم قياسي كامل)'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 leading-relaxed border-t border-[#1E2538] pt-2">
            المعادلة: <code className="text-purple-300 font-mono">Synced_Price = Binance_Price * Rolling_Basis_Ratio</code>
          </div>
        </div>
      </div>

      {/* 5. Multi-Exchange Failover Network */}
      <div className="bg-[#10141E] border border-[#1E2538] rounded-xl p-4.5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2538] pb-3">
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              شبكة المصادر اللحظية المتعاقبة (Multi-Exchange Failover Watchdog)
            </h3>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            قاعدة الأمان: تحويل تلقائي خلال 3 ثوانٍ إذا تجاوز التأخير 200ms
          </span>
        </div>

        {/* Exchange Nodes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(['BINANCE', 'BYBIT', 'OKX', 'MT5_DEMO'] as ExchangeSource[]).map((src) => {
            const ex = exchanges?.[src] || {
              name: src,
              labelAr: src,
              status: 'STANDBY',
              latencyMs: 50,
              lastPrice: 4478.50,
              lastUpdated: new Date().toISOString(),
              tradeCount: 0,
              errorCount: 0,
            };

            const isPrimary = activePrimarySource === src;
            const isConnected = ex.status === 'CONNECTED';

            return (
              <div
                key={src}
                className={`p-3.5 rounded-xl border transition-all ${
                  isPrimary
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5'
                    : 'bg-[#131722] border-[#1E2538] hover:border-[#2D3748]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    {ex.labelAr}
                  </span>
                  {isPrimary && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500 text-black">
                      المصدر النشط
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>الحالة:</span>
                    <span className={`font-bold ${isConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {isConnected ? 'متصل (Active 🟢)' : ex.status === 'RECONNECTING' ? 'إعادة ربط 🟡' : 'استعداد ⚪'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>التأخير (Latency):</span>
                    <span className={`font-bold ${ex.latencyMs <= 100 ? 'text-emerald-400' : ex.latencyMs <= 200 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {ex.latencyMs} ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>آخر سعر مستلم:</span>
                    <span className="font-bold text-white">${ex.lastPrice?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>عدد التكات:</span>
                    <span className="text-zinc-300">{ex.tradeCount}</span>
                  </div>
                </div>

                {!isPrimary && (
                  <button
                    onClick={() => handleManualSwitch(src)}
                    disabled={isSwitching}
                    className="w-full mt-3 py-1.5 rounded-lg bg-[#1B2030] hover:bg-[#252C42] text-[11px] font-mono font-semibold text-zinc-300 border border-[#273048] transition active:scale-95 disabled:opacity-50"
                  >
                    تفعيل كمصدر نشط
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Failover Events Log */}
        {failoverEvents && failoverEvents.length > 0 && (
          <div className="border-t border-[#1E2538] pt-3">
            <div className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
              <span>سجل التحويل التلقائي الأخير (Auto-Failover Events):</span>
            </div>
            <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
              {failoverEvents.slice(0, 3).map((ev) => (
                <div key={ev.id} className="text-xs font-mono bg-[#141926] p-2 rounded-lg border border-[#1E2538] flex items-center justify-between text-zinc-300">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold">{ev.from} ➔ {ev.to}</span>
                    <span className="text-gray-400 text-[11px]">{ev.reasonAr}</span>
                  </div>
                  <span className="text-[11px] text-gray-500 shrink-0">{ev.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 6. MGC Volume & Value Engine (VWAP, PoC, Value Area 70%) */}
      <div className="bg-[#10141E] border border-[#1E2538] rounded-xl p-4.5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2538] pb-3">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                محرك الأحجام والقيمة المؤسسية (MGC Volume & Value Engine)
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                سحب عقود MGC=F من ياهو فاينانس مع مضاعفة الحجم (*10) للمعايرة مع GC الكامل وحساب Anchored VWAP و PoC كل 5 دقائق
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-[#151926] border border-blue-500/30 text-blue-300">
              حجم GC المعاير: {(volumeValueEngine?.gcCalibratedVolume ?? 257300).toLocaleString('ar-EG')} عقد
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Anchored VWAP */}
          <div className="p-3 rounded-lg bg-[#141926] border border-[#20273A]">
            <div className="text-[11px] text-gray-400 mb-1">Anchored VWAP (حجم MGC*10):</div>
            <div className="text-lg font-black font-mono text-cyan-400">
              ${(volumeValueEngine?.anchoredVWAP ?? 4464.8).toFixed(2)}
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">المحور السعري الحجمي للجلسة</div>
          </div>

          {/* Point of Control (PoC) */}
          <div className="p-3 rounded-lg bg-[#141926] border border-[#20273A]">
            <div className="text-[11px] text-gray-400 mb-1">نقطة التحكم السعرية (PoC):</div>
            <div className="text-lg font-black font-mono text-amber-400">
              ${(volumeValueEngine?.pocPrice ?? 4466.5).toFixed(2)}
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">
              حجم الذروة: {(volumeValueEngine?.pocVolume ?? 48200).toLocaleString('ar-EG')} عقد
            </div>
          </div>

          {/* Value Area High (VAH 70%) */}
          <div className="p-3 rounded-lg bg-[#141926] border border-[#20273A]">
            <div className="text-[11px] text-gray-400 mb-1">أعلى منطقة القيمة (VAH 70%):</div>
            <div className="text-lg font-black font-mono text-emerald-400">
              ${volumeValueEngine?.vahPrice?.toFixed(2)}
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">حد المقاومة الحجمية العلوية</div>
          </div>

          {/* Value Area Low (VAL 70%) */}
          <div className="p-3 rounded-lg bg-[#141926] border border-[#20273A]">
            <div className="text-[11px] text-gray-400 mb-1">أدنى منطقة القيمة (VAL 70%):</div>
            <div className="text-lg font-black font-mono text-rose-400">
              ${volumeValueEngine?.valPrice?.toFixed(2)}
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">حد الدعم الحجمي السفلي</div>
          </div>
        </div>

        {/* Early Liquidity Gaps Detected */}
        {volumeValueEngine?.earlyLiquidityGaps && volumeValueEngine.earlyLiquidityGaps.length > 0 && (
          <div className="border-t border-[#1E2538] pt-3">
            <div className="text-xs font-bold text-gray-300 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>فجوات السيولة المبكرة المرصودة (Early Liquidity Imbalances):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {volumeValueEngine.earlyLiquidityGaps.map((gap, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-[#141926] border border-[#20273A] text-xs font-mono flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${gap.zone === 'ABOVE_POC' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                    <span className="text-zinc-200">{gap.noteAr}</span>
                  </div>
                  <span className="text-[11px] text-amber-400 font-bold">عقدة حجم منخفض</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
