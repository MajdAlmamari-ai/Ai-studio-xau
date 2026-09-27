import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, ShieldCheck, Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import { SpotAnalysis } from '../../../server/engines/SpotEngine';

interface SpotAnalysisTabProps {
  currentPrice: number;
}

export const SpotAnalysisTab: React.FC<SpotAnalysisTabProps> = ({ currentPrice }) => {
  const [analysis, setAnalysis] = useState<SpotAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<string>('15m');

  const fetchAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spot/analysis?timeframe=${timeframe}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
      } else {
        throw new Error('بيانات التحليل الفوري غير متوفرة حالياً');
      }
    } catch (err: any) {
      setError(err?.message || 'فشل جلب التحليل الفوري');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [timeframe]);

  const displayPrice = (analysis?.currentPrice ?? currentPrice) || 2700;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner with Price & Timeframe */}
      <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">السعر الفوري للذهب (XAU/USD Spot)</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                OANDA:XAUUSD
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">تحليل هيكل حركة السعر الفوري ومناطق التنفيذ المؤسساتية المعتمدة</p>
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
                    ? 'bg-emerald-500 text-black font-bold shadow-sm'
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
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-bold">تنبيه توفر البيانات:</p>
            <p className="text-xs text-amber-300/80">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Live Price */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">السعر الفوري الحالي</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-emerald-400">
              ${displayPrice.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 block">مصدر التسعير: OANDA Spot Feed</span>
        </div>

        {/* Direction & Confidence */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">الاتجاه والنقاط المؤسساتية</span>
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
          <span className="text-[10px] text-zinc-400 mt-1 block">تقييم الخوارزمية الفورية</span>
        </div>

        {/* ATR Volatility */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">متوسط مدى التذبذب (ATR 14)</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-white">
              ${analysis?.atr?.toFixed(2) ?? '5.00'}
            </span>
            <span className="text-xs text-zinc-400">نطاق الحركة</span>
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 block">محسوب من آخر الشموع الحقيقية</span>
        </div>

        {/* VWAP */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">متوسط السعر بحجم التداول (VWAP)</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-cyan-400">
              ${analysis?.vwap?.toFixed(2) ?? displayPrice.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 block">نقطة الارتكاز المؤسساتي اليومي</span>
        </div>
      </div>

      {/* Execution Targets & Confluence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entry / SL / TP Levels */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white">مستويات التنفيذ وإدارة المخاطر (R:R Floor ≥ 1:2.0)</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono text-sm">
            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block font-sans">سعر الدخول المقترح (Entry)</span>
              <span className="text-lg font-bold text-white mt-1 block">
                {analysis?.entry ? `$${analysis.entry.toFixed(2)}` : 'انتظار إشارة مناسبة'}
              </span>
            </div>

            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block font-sans">وقف الخسارة المحمي (SL)</span>
              <span className="text-lg font-bold text-rose-400 mt-1 block">
                {analysis?.stopLoss ? `$${analysis.stopLoss.toFixed(2)}` : '—'}
              </span>
            </div>

            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block font-sans">الهدف الأول (TP1 - 1:2.0)</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">
                {analysis?.takeProfit1 ? `$${analysis.takeProfit1.toFixed(2)}` : '—'}
              </span>
            </div>

            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block font-sans">الهدف الثاني (TP2 - 1:3.5)</span>
              <span className="text-lg font-bold text-emerald-300 mt-1 block">
                {analysis?.takeProfit2 ? `$${analysis.takeProfit2.toFixed(2)}` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Confluence & Structural Factors */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white">العوامل الهيكلية والتوافق المؤسساتي</h3>
          </div>

          <div className="space-y-2">
            {analysis?.confluence && analysis.confluence.length > 0 ? (
              analysis.confluence.map((conf, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-zinc-300 bg-[#0A0C10] p-2.5 rounded-lg border border-[#1A1F2E]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
                  <span>{conf}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-zinc-400 p-4 text-center bg-[#0A0C10] rounded-lg border border-[#1A1F2E]">
                لا توجد عوامل توافق هيكلي كافية في الوقت الحالي
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
