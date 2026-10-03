import React, { useState, useEffect } from 'react';
import { Layers, TrendingUp, TrendingDown, Minus, Activity, BarChart3, AlertTriangle, RefreshCw, Clock, ShieldCheck } from 'lucide-react';
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
      const contentType = res.headers.get('content-type') || '';
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setAnalysis(data.analysis);
          return;
        }
      }
      
      if (contentType.includes('application/json')) {
        const errorData = await res.json();
        setError(errorData.error?.message || 'بيانات العقود الآجلة قيد المزامنة...');
      } else {
        setError('جاري مزامنة عقود الذهب الآجلة (COMEX GC TPO)... يرجى الانتظار');
      }
    } catch {
      setError('جاري الاتصال بخادم بيانات العقود الآجلة...');
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
              <h2 className="text-xl font-bold text-white">عقود الذهب الآجلة (COMEX GC TPO & Momentum)</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                COMEX:GC1!
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">تحليل فرص السعر مع الزمن (TPO)، السعر المرجح بالزمن TWAP، وزخم السعر</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
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
          <span className="text-[10px] text-zinc-400 mt-1 block">قوة الزخم ومناطق TPO</span>
        </div>

        {/* TPO POC & TWAP */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">مستويات TPO (POC & TWAP)</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-black font-mono text-cyan-400">
              POC: ${analysis?.tpo?.poc?.toFixed(2) ?? '---'}
            </span>
          </div>
          <span className="text-[11px] text-zinc-300 font-mono mt-1 block">TWAP: ${analysis?.twap?.toFixed(2) ?? '---'}</span>
        </div>

        {/* Price Momentum & Basis Spread */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">زخم السعر والفرق الأساسي (Basis)</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-black font-mono text-emerald-400">
              Basis: ${analysis?.priceMomentum?.basisSpread ?? 0.00}
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 block">{analysis?.priceMomentum?.momentumStateAr ?? 'مستقر'}</span>
        </div>
      </div>

      {/* TPO Value Area Details Section */}
      <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-6">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-400" />
          تحليل مناطق القيمة الزمنية (Time Price Opportunity - TPO Value Area 70%)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#161B26] border border-[#232A3B]">
            <span className="text-xs text-zinc-400 block">الحد العلوي لمنطقة القيمة (VAH)</span>
            <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">${analysis?.tpo?.vah?.toFixed(2) ?? '---'}</span>
            <span className="text-[10px] text-zinc-400 mt-1 block">مقاومة الوقت والزخم العلوي</span>
          </div>
          <div className="p-4 rounded-xl bg-[#161B26] border border-[#232A3B]">
            <span className="text-xs text-zinc-400 block">نقطة التحكم الزمنية (POC)</span>
            <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">${analysis?.tpo?.poc?.toFixed(2) ?? '---'}</span>
            <span className="text-[10px] text-zinc-400 mt-1 block">التركيز الزمني الأعلى للسعر</span>
          </div>
          <div className="p-4 rounded-xl bg-[#161B26] border border-[#232A3B]">
            <span className="text-xs text-zinc-400 block">الحد السفلي لمنطقة القيمة (VAL)</span>
            <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">${analysis?.tpo?.val?.toFixed(2) ?? '---'}</span>
            <span className="text-[10px] text-zinc-400 mt-1 block">دعم الوقت والزخم السفلي</span>
          </div>
        </div>
      </div>

      {/* Confluence & Reasoning */}
      {analysis?.confluence && analysis.confluence.length > 0 && (
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-6">
          <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            التوافق المؤسساتي وإشارات الاختراق
          </h3>
          <ul className="space-y-2">
            {analysis.confluence.map((c, idx) => (
              <li key={idx} className="text-sm text-zinc-300 flex items-start gap-2 bg-[#161B26] p-3 rounded-lg border border-[#232A3B]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
