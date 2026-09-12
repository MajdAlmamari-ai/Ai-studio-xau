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
  isLoading: boolean;
  onRefreshPrice: () => void;
  onSetCustomPrice: (price: number, label: string) => void;
  config: SMCConfig;
  onUpdateConfig: (newConfig: SMCConfig) => void;
  activeScenario: string;
}

export const LivePriceCard: React.FC<LivePriceCardProps> = ({
  priceData,
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

  // Active current price: uses real-time price from Tencent feed or preserved fallback
  const currentPrice = (priceData && typeof priceData.price === 'number') 
    ? priceData.price 
    : 4337.53;

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customInput);
    if (!isNaN(val) && val > 0) {
      onSetCustomPrice(val, `سعر يدوي ($${val.toFixed(2)})`);
    }
  };

  const handleCalibrateToCurrent = () => {
    if (currentPrice !== null) {
      const base = Math.round(currentPrice);
      onUpdateConfig({
        ...config,
        bullishThreshold: base + 5,
        bearishThreshold: base - 5,
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
          <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">
            {isCfdMode ? 'XAU/USD (Gate CFD)' : 'XAU/USD Spot'}
          </span>
          <h2 className="text-xs font-bold text-zinc-300 tracking-wide">
            {isCfdMode 
              ? 'السعر الحي لعقود الذهب (Gate.io CFD XAUUSD)' 
              : 'السعر الفوري المباشر للذهب (Gate.io Spot API v4 - PAXG)'}
          </h2>
          <a
            href="https://www.gate.com/ar/cfd/XAUUSD?tf_sub=kline"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 underline font-mono mr-1"
            title="فتح شارت الذهب الحي في Gate.io CFD"
          >
            <span>شارت Gate CFD الحي</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex items-center gap-2">
          {priceData?.isOffline ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{priceData.statusMessageAr || 'إعادة الاتصال بـ Gate.io API...'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{isCfdMode ? 'الضبط التلقائي: Gate CFD بث حي' : 'Gate.io Spot API بث حي'}</span>
            </span>
          )}

          <button
            id="trigger-auto-calibrate-btn"
            onClick={handleTriggerAutoCalibration}
            disabled={isLoading || isCalibrating}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold transition disabled:opacity-50"
            title="إعادة الضبط التلقائي الآن ومطابقة شارت Gate CFD"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isCalibrating ? 'animate-spin' : ''}`} />
            <span>ضبط تلقائي حي</span>
          </button>

          <button
            id="refresh-price-btn"
            onClick={onRefreshPrice}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1D26] transition disabled:opacity-50"
            title="تحديث السعر الفوري"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Auto-Calibration Banner & Mode Switcher */}
      <div className="bg-[#0A0C10] border border-[#1A1D26] rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-400">نمط التسعير والمعايرة:</span>
          <div className="inline-flex rounded-lg bg-[#12141B] p-0.5 border border-[#1A1D26] text-[11px] font-mono">
            <button
              onClick={() => handleModeChange('gateio_cfd')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                isCfdMode 
                  ? 'bg-amber-400 text-black font-bold shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {isCfdMode && <Check className="w-3 h-3 text-black" />}
              <span>الضبط التلقائي (Gate CFD XAUUSD)</span>
            </button>
            <button
              onClick={() => handleModeChange('gateio_spot')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                !isCfdMode && priceData?.pricingMode !== 'manual'
                  ? 'bg-amber-400 text-black font-bold shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {!isCfdMode && priceData?.pricingMode !== 'manual' && <Check className="w-3 h-3 text-black" />}
              <span>السعر الفوري الخالص (Gate Spot PAXG)</span>
            </button>
          </div>
        </div>

        {/* Spread / Basis Status */}
        {typeof priceData?.basisSpread === 'number' && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-zinc-400 text-[11px]">فروقات الأسعار (Basis):</span>
            <span className="font-bold text-amber-300">
              {priceData.basisSpread >= 0 ? `+${priceData.basisSpread.toFixed(2)}$` : `${priceData.basisSpread.toFixed(2)}$`}
            </span>
            <span className="text-[10px] text-zinc-500">
              ({priceData.basisSpread >= 0 ? 'علاوة CFD طبيعية Contango' : 'خصم Backwardation'})
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

      {/* Main Big Price Display & Logic Thresholds */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-8 flex flex-col justify-center">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white">
                ${currentPrice.toFixed(2)}
              </span>
              <span className="text-xs font-mono text-zinc-400 uppercase">
                دولار / أونصة ({isCfdMode ? 'Gate.io CFD XAUUSD' : 'Gate.io Spot XAU/USD'})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs font-mono">
              <span className={`flex items-center gap-1 font-bold ${
                (priceData?.change24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {(priceData?.change24h ?? 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {(priceData?.change24h ?? -1.80) >= 0 ? '+' : ''}
                {(priceData?.change24h ?? -1.80).toFixed(2)}%
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400 text-[11px]">
                نطاق 24 ساعة: <strong className="text-white">${priceData?.low24h ? priceData.low24h.toFixed(2) : (currentPrice - 14).toFixed(2)}</strong> - <strong className="text-white">${priceData?.high24h ? priceData.high24h.toFixed(2) : (currentPrice + 10).toFixed(2)}</strong>
              </span>
              {typeof priceData?.bid === 'number' && typeof priceData?.ask === 'number' && (
                <>
                  <span className="text-zinc-600">|</span>
                  <span className="text-amber-400 font-mono text-[11px]">
                    طلب Bid: <strong>${priceData.bid.toFixed(2)}</strong> | عرض Ask: <strong>${priceData.ask.toFixed(2)}</strong> (سبريد: {priceData.spreadPips ?? 2.0} بيب)
                  </span>
                </>
              )}
            </div>

            {/* Quick Price Comparison Card */}
            {priceData?.cfdPrice && priceData?.spotPrice && (
              <div className="mt-2.5 pt-2 border-t border-[#1A1D26] grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="bg-[#0A0C10] p-1.5 rounded border border-[#1A1D26]">
                  <span className="text-zinc-500 block text-[10px]">سعر شارت Gate CFD:</span>
                  <span className="font-bold text-amber-400">${priceData.cfdPrice.toFixed(2)}</span>
                </div>
                <div className="bg-[#0A0C10] p-1.5 rounded border border-[#1A1D26]">
                  <span className="text-zinc-500 block text-[10px]">سعر الفوري Gate Spot:</span>
                  <span className="font-bold text-zinc-300">${priceData.spotPrice.toFixed(2)}</span>
                </div>
                <div className="bg-[#0A0C10] p-1.5 rounded border border-[#1A1D26] col-span-2 sm:col-span-1">
                  <span className="text-zinc-500 block text-[10px]">الفرق السعري (Spread):</span>
                  <span className="font-bold text-emerald-400">
                    {(priceData.cfdPrice - priceData.spotPrice) >= 0 ? '+' : ''}
                    {(priceData.cfdPrice - priceData.spotPrice).toFixed(2)}$
                  </span>
                </div>
              </div>
            )}
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
              <span>{showConfig ? 'إخفاء الإعدادات' : 'تعديل الحدود'}</span>
            </button>
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center bg-[#12141B] px-2 py-1 rounded">
              <span className="text-emerald-400">حد الشراء الصاعد:</span>
              <span className="font-bold text-white">${config.bullishThreshold.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center bg-[#12141B] px-2 py-1 rounded">
              <span className="text-rose-400">حد البيع الهابط:</span>
              <span className="font-bold text-white">${config.bearishThreshold.toFixed(2)}</span>
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
              <label className="block text-[10px] text-zinc-400 mb-1">حد الشراء الصاعد ($)</label>
              <input
                type="number"
                value={config.bullishThreshold}
                onChange={(e) => onUpdateConfig({ ...config, bullishThreshold: parseFloat(e.target.value) || 4345 })}
                className="w-full bg-[#0A0C10] border border-zinc-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="bg-[#12141B] p-2 rounded border border-[#1A1D26]">
              <label className="block text-[10px] text-zinc-400 mb-1">حد البيع الهابط ($)</label>
              <input
                type="number"
                value={config.bearishThreshold}
                onChange={(e) => onUpdateConfig({ ...config, bearishThreshold: parseFloat(e.target.value) || 4330 })}
                className="w-full bg-[#0A0C10] border border-zinc-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
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
            onClick={() => onSetCustomPrice(config.bullishThreshold + 3.5, `سيناريو صاعد (> ${config.bullishThreshold})`)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition text-center ${
              activeScenario.includes('صاعد') || activeScenario.includes('Bullish')
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                : 'bg-[#0A0C10] border-[#1A1D26] text-zinc-300 hover:bg-[#1A1D26]'
            }`}
          >
            ● سيناريو صاعد (${(config.bullishThreshold + 3.5).toFixed(1)})
          </button>

          <button
            id="scenario-bearish-btn"
            onClick={() => onSetCustomPrice(config.bearishThreshold - 4.5, `سيناريو هابط (< ${config.bearishThreshold})`)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition text-center ${
              activeScenario.includes('هابط') || activeScenario.includes('Bearish')
                ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-bold'
                : 'bg-[#0A0C10] border-[#1A1D26] text-zinc-300 hover:bg-[#1A1D26]'
            }`}
          >
            ● سيناريو هابط (${(config.bearishThreshold - 4.5).toFixed(1)})
          </button>

          <button
            id="scenario-neutral-btn"
            onClick={() => onSetCustomPrice((config.bullishThreshold + config.bearishThreshold) / 2, 'نطاق تجميعي (انتظار)')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition text-center ${
              activeScenario.includes('تجميعي') || activeScenario.includes('Consolidation')
                ? 'bg-amber-400/10 border-amber-400 text-amber-300 font-bold'
                : 'bg-[#0A0C10] border-[#1A1D26] text-zinc-300 hover:bg-[#1A1D26]'
            }`}
          >
            ● تذبذب وانتظار (${((config.bullishThreshold + config.bearishThreshold) / 2).toFixed(1)})
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
