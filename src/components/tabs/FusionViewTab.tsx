import React, { useState, useEffect } from 'react';
import { GitCompare, CheckCircle2, AlertTriangle, AlertCircle, ArrowUpRight, ArrowDownRight, Clock, ShieldAlert, RefreshCw, Zap } from 'lucide-react';
import { FusionResult } from '../../../server/fusion/ComparisonEngine';

export const FusionViewTab: React.FC = () => {
  const [fusion, setFusion] = useState<FusionResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<string>('15m');

  const fetchFusion = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fusion/analysis?timeframe=${timeframe}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'LIVE') {
          setFusion(data);
          return;
        }
      }
      
      // If server returned non-ok status (e.g. 503 during historical backfill)
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorJson = await res.json();
        const msg = errorJson.error?.message || 'جاري تجميع وحفظ شموع الذهب لتأكيد طبقة الدمج والمقارنة...';
        setError(msg);
      } else {
        // Returned HTML (e.g. 502/503 proxy page or Vite reload)
        setError('جاري تهيئة خادم التحليل المؤسساتي... يرجى الانتظار ثوانٍ قليلة');
      }
    } catch {
      setError('جاري الاتصال بخادم التحليل والدمج المؤسساتي...');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFusion();
  }, [timeframe]);

  const alignment = fusion?.alignment ?? 'PARTIAL';
  const verdict = fusion?.verdict ?? 'WAIT';

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner with Verdict & Refresh */}
      <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <GitCompare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">طبقة الدمج والمقارنة (Institutional Fusion Layer)</h2>
              <span
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                  alignment === 'FULL'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : alignment === 'PARTIAL'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                {alignment === 'FULL'
                  ? 'توافق كامل (FULL)'
                  : alignment === 'PARTIAL'
                  ? 'توافق جزئي (PARTIAL)'
                  : 'تباين وتضارب (DIVERGENT)'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              مقارنة وتطابق حركة السعر الفوري (OANDA) مع العقود الآجلة (COMEX GC) وفارق السعر Basis
            </p>
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
                    ? 'bg-indigo-500 text-white font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={fetchFusion}
            disabled={isLoading}
            className="p-2 rounded-lg bg-[#161B26] hover:bg-[#1E2536] text-zinc-300 hover:text-white border border-[#2A3142] transition-colors"
            title="تحديث التحليل"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-bold">تنبيه البيانات:</p>
            <p className="text-xs text-amber-300/80">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Main Unified Verdict Box */}
      <div className="bg-gradient-to-r from-[#121624] via-[#10141F] to-[#121624] border border-[#22283D] rounded-xl p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-right">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              القرار المؤسساتي الموحد (Final Institutional Verdict)
            </span>
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                {fusion?.verdictAr ?? 'انتظار وتريث (WAIT)'}
              </h3>
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                  verdict.includes('BUY')
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : verdict.includes('SELL')
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                }`}
              >
                {verdict}
              </span>
            </div>
            <p className="text-xs text-zinc-400 max-w-xl">
              توصية مبنية على دمج كتل الأوامر الفورية، أحجام عقود شيكاغو الحقيقية، دلتا CVD، وفارق السعر Basis.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-[#0A0D14] rounded-xl border border-[#1E2538] min-w-[160px]">
            <span className="text-xs text-zinc-400">نسبة التوافق المؤسساتي</span>
            <span className="text-4xl font-black font-mono text-indigo-400 mt-1">
              {fusion?.confluenceScore ?? 50}%
            </span>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${fusion?.confluenceScore ?? 50}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side: Spot vs Futures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Spot Side */}
        <div className="bg-[#11141D] border border-emerald-500/20 rounded-xl p-5 relative">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2333]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <h3 className="font-bold text-white">السعر الفوري (XAU/USD Spot)</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold">OANDA:XAUUSD</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block">الاتجاه الفوري</span>
              <span className="text-lg font-bold text-white mt-1 block">
                {fusion?.spotAnalysis?.direction === 'LONG'
                  ? 'صاعد (LONG)'
                  : fusion?.spotAnalysis?.direction === 'SHORT'
                  ? 'هابط (SHORT)'
                  : 'محايد (NEUTRAL)'}
              </span>
            </div>

            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block">نقاط القوة</span>
              <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                {fusion?.spotAnalysis?.score ?? 50}/100
              </span>
            </div>

            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block">متوسط المدى (ATR)</span>
              <span className="text-lg font-bold font-mono text-white mt-1 block">
                ${fusion?.spotAnalysis?.atr?.toFixed(2) ?? '5.00'}
              </span>
            </div>

            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block">نقطة الارتكاز (VWAP)</span>
              <span className="text-lg font-bold font-mono text-cyan-400 mt-1 block">
                ${fusion?.spotAnalysis?.vwap?.toFixed(2) ?? '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Futures Side */}
        <div className="bg-[#11141D] border border-amber-500/20 rounded-xl p-5 relative">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2333]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <h3 className="font-bold text-white">العقود الآجلة (COMEX GC Futures)</h3>
            </div>
            <span className="text-xs font-mono text-amber-400 font-bold">COMEX:GC1!</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block">الاتجاه الآجل</span>
              <span className="text-lg font-bold text-white mt-1 block">
                {fusion?.futuresAnalysis?.direction === 'LONG'
                  ? 'صاعد (LONG)'
                  : fusion?.futuresAnalysis?.direction === 'SHORT'
                  ? 'هابط (SHORT)'
                  : 'محايد (NEUTRAL)'}
              </span>
            </div>

            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block">نقاط القوة</span>
              <span className="text-lg font-bold font-mono text-amber-400 mt-1 block">
                {fusion?.futuresAnalysis?.score ?? 50}/100
              </span>
            </div>

            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block">دلتا تدفق الأوامر (CVD)</span>
              <span
                className={`text-lg font-bold font-mono mt-1 block ${
                  (fusion?.futuresAnalysis?.cvd?.cumulativeDelta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {(fusion?.futuresAnalysis?.cvd?.cumulativeDelta ?? 0) >= 0 ? '+' : ''}
                {fusion?.futuresAnalysis?.cvd?.cumulativeDelta ?? 0}
              </span>
            </div>

            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block">الفائدة المفتوحة (OI)</span>
              <span className="text-lg font-bold font-mono text-cyan-400 mt-1 block">
                {fusion?.futuresAnalysis?.openInterest ? fusion.futuresAnalysis.openInterest.toLocaleString() : 'غير متاح'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Basis Analysis & Unified Reasoning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basis Card */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white">تحليل فارق السعر بين الأسواق (Basis Analysis)</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono">
            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block font-sans">فارق السعر (Futures - Spot)</span>
              <span className="text-2xl font-bold text-white mt-1 block">
                ${fusion?.basisAnalysis?.current?.toFixed(2) ?? '10.00'}
              </span>
            </div>

            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333]">
              <span className="text-xs text-zinc-400 block font-sans">الانحراف المعياري (Z-Score)</span>
              <span
                className={`text-2xl font-bold mt-1 block ${
                  Math.abs(fusion?.basisAnalysis?.zScore ?? 0) >= 2.5
                    ? 'text-rose-400'
                    : Math.abs(fusion?.basisAnalysis?.zScore ?? 0) >= 1.5
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {fusion?.basisAnalysis?.zScore ?? '0.00'}
              </span>
            </div>
          </div>

          <div className="mt-3 p-3 bg-[#0A0C10] rounded-lg border border-[#1E2333] flex items-center justify-between text-xs text-zinc-400">
            <span>الحالة الإحصائية:</span>
            <span className="font-bold text-white">{fusion?.basisAnalysis?.statusAr ?? 'طبيعي ومستقر'}</span>
          </div>
        </div>

        {/* Reasoning and Warnings */}
        <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white">أسباب القرار المؤسساتي والتنبيهات</h3>
          </div>

          <div className="space-y-2">
            {fusion?.unifiedRecommendation?.reasoningAr && fusion.unifiedRecommendation.reasoningAr.length > 0 ? (
              fusion.unifiedRecommendation.reasoningAr.map((r, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-zinc-300 bg-[#0A0C10] p-2.5 rounded-lg border border-[#1A1F2E]">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0"></span>
                  <span>{r}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-zinc-400 p-3 bg-[#0A0C10] rounded-lg border border-[#1A1F2E]">
                جاري إعداد الأسباب المؤسساتية...
              </div>
            )}
          </div>

          {fusion?.warnings && fusion.warnings.length > 0 ? (
            <div className="space-y-1.5 pt-2 border-t border-[#1E2333]">
              <span className="text-[11px] font-bold text-amber-400 block">تنبيهات الفوارق والمخاطر:</span>
              {fusion.warnings.map((w, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
