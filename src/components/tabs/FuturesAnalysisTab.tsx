import React, { useState, useEffect } from 'react';
import { Layers, TrendingUp, TrendingDown, Minus, ShieldCheck, Activity, BarChart3, AlertTriangle, RefreshCw } from 'lucide-react';
import { FuturesAnalysis } from '../../../server/engines/FuturesEngine';

interface FuturesAnalysisTabProps {
  currentPrice?: number;
}

export const FuturesAnalysisTab: React.FC<FuturesAnalysisTabProps> = ({ currentPrice = 2710 }) => {
  const [analysis, setAnalysis] = useState<FuturesAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<string>('15m');

  const fetchAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/futures/analysis?timeframe=${timeframe}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
      } else {
        throw new Error('بيانات العقود الآجلة غير متوفرة حالياً');
      }
    } catch (err: any) {
      setError(err?.message || 'فشل جلب تحليل العقود الآجلة');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [timeframe]);

  const displayPrice = (analysis?.currentPrice ?? currentPrice) || 2710;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner with Price & Timeframe */}
      <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">عقود الذهب الآجلة (COMEX GC Futures)</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                COMEX:GC1!
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">تحليل أحجام التداول الحقيقية من بورصة شيكاغو وتدفق الأوامر CVD</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-[#0A0C10] p-1 rounded-lg border border-[#1A1F2E]">
            {['5m', '15m', '1h', '4h', '1d'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                  timeframe === tf
                    ? 'bg-amber-500 text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAnalysis}
            disabled={isLoading}
            className="p-2 rounded-lg bg-[#161B26] hover:bg-[#1E2536] text-zinc-300 hover:text-white border border-[#2A3142] transition-colors"
            title="تحديث التحليل"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-bold">تنبيه توفر البيانات الآجلة:</p>
            <p className="text-xs text-amber-300/80">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Futures Live Price */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">سعر العقد الآجل الحالي</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-amber-400">
              ${displayPrice.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 block">مصدر التسعير: COMEX GC Futures</span>
        </div>

        {/* Direction & Institutional Score */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">الاتجاه الآجل ونقاط التقييم</span>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 font-bold">
              {analysis?.direction === 'LONG' ? (
                <>
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-400 text-lg">صاعد (LONG)</span>
                </>
              ) : analysis?.direction === 'SHORT' ? (
                <>
                  <TrendingDown className="w-5 h-5 text-rose-400" />
                  <span className="text-rose-400 text-lg">هابط (SHORT)</span>
                </>
              ) : (
                <>
                  <Minus className="w-5 h-5 text-zinc-400" />
                  <span className="text-zinc-300 text-lg">محايد (NEUTRAL)</span>
                </>
              )}
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#161B26] text-amber-400 border border-amber-500/20">
              {analysis?.score ?? 50}/100
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 block">قوة تدفقات كبار المتداولين</span>
        </div>

        {/* CVD Delta */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">دلتا تدفق الأوامر التراكمي (CVD)</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              className={`text-2xl font-black font-mono ${
                (analysis?.cvd?.cumulativeDelta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {(analysis?.cvd?.cumulativeDelta ?? 0) >= 0 ? '+' : ''}
              {analysis?.cvd?.cumulativeDelta ?? 0}
            </span>
            <span className="text-xs text-zinc-400">عقد</span>
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 block">Institutional Order Flow Delta</span>
        </div>

        {/* Open Interest */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">الفائدة المفتوحة (Open Interest)</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-cyan-400">
              {analysis?.openInterest ? analysis.openInterest.toLocaleString() : 'غير متاح'}
            </span>
            {analysis?.openInterest ? <span className="text-xs text-zinc-400">عقد</span> : null}
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 block">حجم المراكز المفتوحة في COMEX</span>
        </div>
      </div>

      {/* CVD Volume Details & Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CVD Breakdown */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white">تفصيل أحجام الشراء والبيع (Institutional Volume)</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono text-sm">
            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block font-sans">حجم الشراء القوي (Buy Vol)</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">
                {analysis?.cvd?.buyVolume ? `${analysis.cvd.buyVolume.toLocaleString()} عقد` : '—'}
              </span>
            </div>

            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block font-sans">حجم البيع القوي (Sell Vol)</span>
              <span className="text-lg font-bold text-rose-400 mt-1 block">
                {analysis?.cvd?.sellVolume ? `${analysis.cvd.sellVolume.toLocaleString()} عقد` : '—'}
              </span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#0A0C10] rounded-lg border border-[#1E2333] flex items-center justify-between text-xs text-zinc-400 font-mono">
            <span>متوسط المدى (ATR 14): ${analysis?.atr?.toFixed(2) ?? '5.00'}</span>
            <span>نقطة الارتكاز (VWAP): ${analysis?.vwap?.toFixed(2) ?? displayPrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Confluence & Order Blocks */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white">إشارات وتأكيدات العقود الآجلة</h3>
          </div>

          <div className="space-y-2">
            {analysis?.confluence && analysis.confluence.length > 0 ? (
              analysis.confluence.map((conf, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-zinc-300 bg-[#0A0C10] p-2.5 rounded-lg border border-[#1A1F2E]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></span>
                  <span>{conf}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-zinc-400 p-4 text-center bg-[#0A0C10] rounded-lg border border-[#1A1F2E]">
                لا توجد عوامل تأكيد واضحة في الوقت الحالي
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
