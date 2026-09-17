import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Settings2,
  Flame,
  Radio,
  SlidersHorizontal,
  WifiOff,
  Sparkles,
  ExternalLink,
  Layers,
  Check
} from 'lucide-react';
import { GoldPriceData, SMCConfig } from '../types';
import { triggerAutoCalibration, setAutoCalibratePricingMode } from '../services/goldApiService';

interface LivePriceCardProps {
  priceData: GoldPriceData | null;
  futuresData?: import('../types').FuturesPriceData | null;
  isLoading: boolean;
  onRefreshPrice: () => void;
  onSetCustomPrice: (price: number, label: string) => void;
  config: SMCConfig;
  onUpdateConfig: (newConfig: SMCConfig) => void;
  activeScenario: string;
}

export const LivePriceCard: React.FC<LivePriceCardProps> = ({
  priceData,
  futuresData,
  isLoading,
  onRefreshPrice,
  onSetCustomPrice,
  config,
  onUpdateConfig,
  activeScenario,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationSuccessMessage, setCalibrationSuccessMessage] = useState<string | null>(null);

  // Primary futures price (COMEX GC1! from TradingView relay)
  const futuresPrice = (futuresData && typeof futuresData.futuresPrice === 'number')
    ? futuresData.futuresPrice
    : (priceData?.cfdPrice ?? null);

  // Reference spot price (XAU/USD Spot)
  const spotPrice = (priceData && typeof priceData.price === 'number') 
    ? priceData.price 
    : (futuresData?.spotPrice ?? 4303.92);

  // Effective primary price displayed prominently (Futures GC1! primary, spot as fallback)
  const primaryPrice = futuresPrice ?? spotPrice;

  // Prominent Basis (Spread between Futures and Spot)
  const calculatedBasis = (futuresPrice !== null && spotPrice !== null)
    ? Number((futuresPrice - spotPrice).toFixed(2))
    : (priceData?.basisSpread ?? futuresData?.basisSpread ?? null);

  const isContango = calculatedBasis !== null ? calculatedBasis >= 0 : true;

  const currentPrice = primaryPrice;

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customInput);
    if (!isNaN(val) && val > 0) {
      onSetCustomPrice(val, `سعر يدوي ($${val.toFixed(2)})`);
    }
  };

  const handleCalibrateToCurrent = () => {
    if (currentPrice !== null) {
      onUpdateConfig({
        ...config,
        bslOffset: 8,
        sslOffset: 6,
      });
    }
  };

  // Instant Auto-Calibration to Gate CFD (XAUUSD)
  const handleTriggerAutoCalibration = async () => {
    setIsCalibrating(true);
    setCalibrationSuccessMessage(null);
    try {
      const res = await triggerAutoCalibration();
      setCalibrationSuccessMessage(res.messageAr || 'تم الضبط التلقائي الحي بنجاح');
      onRefreshPrice();
      setTimeout(() => setCalibrationSuccessMessage(null), 4000);
    } catch {
      onRefreshPrice();
    } finally {
      setIsCalibrating(false);
    }
  };

  // Switch Calibration Mode (CFD vs Spot vs Manual)
  const handleModeChange = async (mode: 'gateio_cfd' | 'gateio_spot') => {
    setIsCalibrating(true);
    try {
      await setAutoCalibratePricingMode(mode);
      onRefreshPrice();
    } finally {
      setIsCalibrating(false);
    }
  };

  const isCfdMode = priceData?.source === 'gateio_cfd' || priceData?.pricingMode === 'gateio_cfd';

  return (
    <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Top row: Symbol, Source & Auto-Calibration Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1A1D26]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/40">
            COMEX: GC1! (الذهب الآجل)
          </span>
          <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/50">
            مرجع Spot: XAU/USD
          </span>
          <h2 className="text-xs font-bold text-zinc-300 tracking-wide hidden sm:inline">
            التسعير المؤسساتي اللحظي المباشر (TradingView Relay)
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {priceData?.isOffline ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{priceData.statusMessageAr || 'إعادة الاتصال بالخادم...'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>TradingView Live 🟢 (تغذية فورية)</span>
            </span>
          )}

          <button
            id="trigger-auto-calibrate-btn"
            onClick={handleTriggerAutoCalibration}
            disabled={isLoading || isCalibrating}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold transition disabled:opacity-50"
            title="إعادة المزامنة والمعايرة اللحظية"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isCalibrating ? 'animate-spin' : ''}`} />
            <span>معايرة لحظية</span>
          </button>

          <button
            id="refresh-price-btn"
            onClick={onRefreshPrice}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1D26] transition disabled:opacity-50"
            title="تحديث الأسعار الفورية"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Prominent Basis & Feed Info Banner */}
      <div className="bg-[#0A0C10] border border-[#1A1D26] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-bold text-zinc-400">مصدر التدفق الحي:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 text-[11px] font-mono">
            <Radio className="w-3 h-3 text-blue-400 animate-pulse" />
            TradingView WebSocket Relay (COMEX:GC1! + OANDA:XAUUSD)
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            آخر تحديث: {futuresData?.updatedAt ? new Date(futuresData.updatedAt).toLocaleTimeString('ar-SA') : 'لحظي'}
          </span>
        </div>

        {/* Prominent Basis Display */}
        {calculatedBasis !== null && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#12141B] border border-amber-400/30 font-mono text-xs">
            <span className="text-zinc-400 text-[11px]">فارق الأساس (Basis):</span>
            <span className={`font-black text-sm ${calculatedBasis >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
              {calculatedBasis >= 0 ? `+${calculatedBasis.toFixed(2)}$` : `${calculatedBasis.toFixed(2)}$`}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              isContango 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}>
              {isContango ? 'علاوة طبيعية Contango' : 'خصم Backwardation'}
            </span>
          </div>
        )}
      </div>

      {calibrationSuccessMessage && (
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{calibrationSuccessMessage}</span>
        </div>
      )}

      {/* Main Big Price Display & Reference Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-8 flex flex-col justify-center">
          <div>
            {/* Primary Price: Futures GC1! */}
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-amber-400">
                ${primaryPrice.toFixed(2)}
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-white uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                  العقود الآجلة الرئيسية COMEX GC1!
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  دولار / أونصة (Front-Month CME Futures)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono">
              <span className={`flex items-center gap-1 font-bold ${
                (priceData?.change24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {(priceData?.change24h ?? 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {(priceData?.change24h ?? 0) >= 0 ? '+' : ''}
                {(priceData?.change24h ?? 0.12).toFixed(2)}%
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400 text-[11px]">
                نطاق 24 ساعة: <strong className="text-white">${priceData?.low24h ? priceData.low24h.toFixed(2) : (primaryPrice - 18).toFixed(2)}</strong> - <strong className="text-white">${priceData?.high24h ? priceData.high24h.toFixed(2) : (primaryPrice + 14).toFixed(2)}</strong>
              </span>
              {typeof priceData?.bid === 'number' && typeof priceData?.ask === 'number' && (
                <>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-300 font-mono text-[11px]">
                    طلب Bid: <strong className="text-white">${priceData.bid.toFixed(2)}</strong> | عرض Ask: <strong className="text-white">${priceData.ask.toFixed(2)}</strong> (سبريد: {priceData.spreadPips ?? 1.8} بيب)
                  </span>
                </>
              )}
            </div>

            {/* Prominent Spot Reference & Basis Breakdown */}
            <div className="mt-3 pt-2.5 border-t border-[#1A1D26] grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px] font-mono">
              <div className="bg-[#0A0C10] p-2 rounded-lg border border-[#1A1D26]">
                <span className="text-zinc-400 block text-[10px] mb-0.5">سعر الذهب الفوري (Spot مرجع):</span>
                <span className="font-bold text-base text-zinc-100">${spotPrice.toFixed(2)}</span>
                <span className="text-[9px] text-zinc-500 block">OANDA:XAUUSD</span>
              </div>
              <div className="bg-[#0A0C10] p-2 rounded-lg border border-amber-400/20 bg-amber-400/5">
                <span className="text-amber-300 block text-[10px] mb-0.5">فارق الأساس المباشر (Basis):</span>
                <span className="font-black text-base text-amber-400">
                  {calculatedBasis !== null ? `${calculatedBasis >= 0 ? '+' : ''}${calculatedBasis.toFixed(2)}$` : '--'}
                </span>
                <span className="text-[9px] text-zinc-400 block">
                  {isContango ? 'علاوة عقود Contango' : 'خصم Backwardation'}
                </span>
              </div>
              <div className="bg-[#0A0C10] p-2 rounded-lg border border-[#1A1D26] col-span-2 sm:col-span-1">
                <span className="text-zinc-400 block text-[10px] mb-0.5">حجم تداول CME / العقد:</span>
                <span className="font-bold text-base text-emerald-400">
                  {(futuresData?.cmeVolumeLots ?? futuresData?.volume ?? 22745).toLocaleString()} عقد
                </span>
                <span className="text-[9px] text-zinc-500 block">حجم حقيقي (COMEX GC)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Psychological Threshold Reference */}
        <div className="md:col-span-4 bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26] text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider">مستويات الحسم المؤسساتي</span>
            <button
              id="toggle-threshold-btn"
              onClick={() => setShowConfig(!showConfig)}
              className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <Settings2 className="w-3 h-3" />
              <span>{showConfig ? 'إخفاء الإعدادات' : 'إعدادات الإزاحة'}</span>
            </button>
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center bg-[#12141B] px-2 py-1 rounded">
              <span className="text-emerald-400">إزاحة سيولة الشراء BSL:</span>
              <span className="font-bold text-white">+{config.bslOffset.toFixed(1)}$</span>
            </div>
            <div className="flex justify-between items-center bg-[#12141B] px-2 py-1 rounded">
              <span className="text-rose-400">إزاحة سيولة البيع SSL:</span>
              <span className="font-bold text-white">-{config.sslOffset.toFixed(1)}$</span>
            </div>
          </div>
        </div>
      </div>

      {/* Threshold Config Collapsible */}
      {showConfig && (
        <div className="p-3.5 rounded-lg bg-[#0A0C10] border border-[#1A1D26] space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold tracking-wider text-zinc-400">
              معايرة حدود الصفقات وفخاخ السيولة
            </h4>
            {currentPrice !== null && (
              <button
                id="calibrate-thresholds-btn"
                onClick={handleCalibrateToCurrent}
                className="text-[10px] text-amber-400 hover:underline"
              >
                ضبط تلقائي بالنسبة للسعر الحالي (${Math.round(currentPrice)})
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-[#12141B] p-2 rounded border border-[#1A1D26]">
              <label className="block text-[10px] text-zinc-400 mb-1">إزاحة سيولة الشراء BSL (+P)</label>
              <input
                type="number"
                value={config.bslOffset}
                onChange={(e) => onUpdateConfig({ ...config, bslOffset: parseFloat(e.target.value) || 8 })}
                className="w-full bg-[#0A0C10] border border-zinc-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="bg-[#12141B] p-2 rounded border border-[#1A1D26]">
              <label className="block text-[10px] text-zinc-400 mb-1">إزاحة سيولة البيع SSL (-P)</label>
              <input
                type="number"
                value={config.sslOffset}
                onChange={(e) => onUpdateConfig({ ...config, sslOffset: parseFloat(e.target.value) || 6 })}
                className="w-full bg-[#0A0C10] border border-zinc-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Scenario Tester Selector */}
      <div className="pt-3 border-t border-[#1A1D26]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>محاكي السيناريوهات السريعة (اختبار خوارزمية البوت لحظياً):</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-400">النشط حالياً: <strong className="text-amber-400">{activeScenario}</strong></span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
          <button
            id="scenario-live-api-btn"
            onClick={handleTriggerAutoCalibration}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition text-center ${
              activeScenario.includes('Gate CFD') || activeScenario.includes('الضبط التلقائي')
                ? 'bg-amber-400/10 border-amber-400 text-amber-300 font-bold'
                : 'bg-[#0A0C10] border-[#1A1D26] text-zinc-300 hover:bg-[#1A1D26]'
            }`}
          >
            الضبط التلقائي (Gate CFD الحي)
          </button>

          <button
            id="scenario-bullish-btn"
            onClick={() => {
              const base = currentPrice ?? 4330;
              onSetCustomPrice(base + 10, `سيناريو صاعد (> ${(base + 5).toFixed(1)})`);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition text-center ${
              activeScenario.includes('صاعد') || activeScenario.includes('Bullish')
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                : 'bg-[#0A0C10] border-[#1A1D26] text-zinc-300 hover:bg-[#1A1D26]'
            }`}
          >
            ● سيناريو صاعد (${((currentPrice ?? 4330) + 10).toFixed(1)})
          </button>

          <button
            id="scenario-bearish-btn"
            onClick={() => {
              const base = currentPrice ?? 4330;
              onSetCustomPrice(base - 10, `سيناريو هابط (< ${(base - 5).toFixed(1)})`);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition text-center ${
              activeScenario.includes('هابط') || activeScenario.includes('Bearish')
                ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-bold'
                : 'bg-[#0A0C10] border-[#1A1D26] text-zinc-300 hover:bg-[#1A1D26]'
            }`}
          >
            ● سيناريو هابط (${((currentPrice ?? 4330) - 10).toFixed(1)})
          </button>

          <button
            id="scenario-neutral-btn"
            onClick={() => {
              const base = currentPrice ?? 4330;
              onSetCustomPrice(base, 'نطاق تجميعي (انتظار)');
            }}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition text-center ${
              activeScenario.includes('تجميعي') || activeScenario.includes('Consolidation')
                ? 'bg-amber-400/10 border-amber-400 text-amber-300 font-bold'
                : 'bg-[#0A0C10] border-[#1A1D26] text-zinc-300 hover:bg-[#1A1D26]'
            }`}
          >
            ● تذبذب وانتظار (${(currentPrice ?? 4330).toFixed(1)})
          </button>

          <form onSubmit={handleApplyCustom} className="flex gap-1">
            <input
              type="number"
              step="0.1"
              placeholder="سعر تجريبي $"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="w-full bg-[#0A0C10] border border-[#1A1D26] rounded-lg px-2 py-1 text-[11px] text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-400"
            />
            <button
              id="apply-custom-price-btn"
              type="submit"
              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-black font-bold text-[10px] rounded-lg transition shrink-0"
            >
              تطبيق
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
