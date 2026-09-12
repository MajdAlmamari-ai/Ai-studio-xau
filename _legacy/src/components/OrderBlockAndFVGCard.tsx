import React, { useState } from 'react';
import { SMCAnalysis, OrderBlockDetail, FairValueGap } from '../types';
import { Box, Target, Zap, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, Layers, BarChart3, Sparkles } from 'lucide-react';
import { ZoneFreshnessChart } from './ZoneFreshnessChart';

interface OrderBlockAndFVGCardProps {
  analysis: SMCAnalysis;
}

export const OrderBlockAndFVGCard: React.FC<OrderBlockAndFVGCardProps> = ({ analysis }) => {
  const [activeTab, setActiveTab] = useState<'both' | 'ob' | 'freshness' | 'fvg'>('both');

  const { orderBlocks = [], fvgs = [], currentPrice } = analysis;

  return (
    <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg relative">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-[#1A1D26] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#1A1D26] rounded-lg text-amber-400">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              كتل الأوامر (Order Blocks) وفجوات القيمة العادلة (FVG)
            </h3>
            <p className="text-xs text-zinc-400">
              رصد مناطق عدم التوازن المؤسساتي (Imbalance) ومخطط نضارة الكتل (Zone Freshness) من 0% إلى 100%
            </p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center bg-[#0A0C10] p-1 rounded-lg border border-[#1A1D26] self-start sm:self-auto flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'both' ? 'bg-[#1A1D26] text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setActiveTab('freshness')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'freshness' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>مخطط النضارة (Freshness)</span>
          </button>
          <button
            onClick={() => setActiveTab('ob')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'ob' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            الأوردر بلوك (OB)
          </button>
          <button
            onClick={() => setActiveTab('fvg')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'fvg' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            الفاليو قاب (FVG)
          </button>
        </div>
      </div>

      {/* MT5 Offset Alignment Notice */}
      {analysis.mt5Synchronization && (
        <div className="mb-4 p-2.5 rounded-lg bg-[#0A0C10] border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-zinc-300 font-sans font-medium">محاذاة أسعار الكتل والفجوات مع البث السحابي المباشر:</span>
            <span className="text-emerald-400 font-bold">
              {analysis.mt5Synchronization.brokerServer}
            </span>
          </div>
          <div className="text-indigo-300">
            فارق الإزاحة (Offset): <span className="font-bold text-white">{analysis.mt5Synchronization.spreadOffsetFormatted}</span> (مطبّق على الكتل تلقائياً)
          </div>
        </div>
      )}

      {/* Freshness Chart Display (Dedicated Tab or Embedded) */}
      {activeTab === 'freshness' && (
        <div className="mb-5">
          <ZoneFreshnessChart orderBlocks={orderBlocks} currentPrice={currentPrice} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ORDER BLOCKS SECTION */}
        {(activeTab === 'both' || activeTab === 'ob') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Box className="w-4 h-4" /> كتل الأوامر المؤسساتية (Order Blocks)
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {orderBlocks.length} مناطق مفعلة
              </span>
            </div>

            <div className="space-y-2.5">
              {orderBlocks.map((ob) => {
                const isDemand = ob.type === 'BULLISH_DEMAND';
                const isInside = currentPrice >= ob.min && currentPrice <= ob.max;

                return (
                  <div
                    key={ob.id}
                    className={`p-3.5 rounded-lg border transition-all ${
                      isDemand
                        ? 'bg-emerald-950/10 border-emerald-900/30 hover:border-emerald-700/50'
                        : 'bg-rose-950/10 border-rose-900/30 hover:border-rose-700/50'
                    } ${isInside ? 'ring-2 ring-amber-400/50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            isDemand
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isDemand ? 'كتلة طلب صاعدة (Demand OB)' : 'كتلة عرض هابطة (Supply OB)'}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-[#0A0C10] px-1.5 py-0.5 rounded">
                          {ob.timeframe}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px]">
                        <span
                          className={`font-mono font-semibold px-2 py-0.5 rounded-full ${
                            ob.mitigationStatus === 'Unmitigated'
                              ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {ob.mitigationStatus === 'Unmitigated' ? 'غير مخففة (Unmitigated ⚡)' : 'تم الاختبار (Tested)'}
                        </span>
                      </div>
                    </div>

                    {/* Pricing Range & Equilibrium */}
                    <div className="grid grid-cols-3 gap-2 bg-[#0A0C10] p-2.5 rounded-md border border-[#1A1D26] my-2 text-center">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">الحد الأدنى</span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-white">
                          ${ob.min.toFixed(2)}
                        </span>
                      </div>
                      <div className="border-x border-[#1A1D26]">
                        <span className="text-[10px] text-amber-400 font-semibold block">نقطة التوازن 50% (EQ)</span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-amber-300">
                          ${ob.equilibrium.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">الحد الأقصى</span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-white">
                          ${ob.max.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-[#1A1D26]/60 mt-2">
                      <span>حجم الأوامر: <strong className="text-zinc-200">{ob.volume}</strong></span>
                      <span className="text-emerald-400 font-mono">قوة الدعم: {ob.confluenceScore}%</span>
                    </div>

                    {/* Zone Freshness Progress Bar */}
                    <div className="mt-2.5 pt-2 border-t border-[#1A1D26]">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-zinc-400">
                          نضارة المنطقة (Zone Freshness):
                        </span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-zinc-400 text-[10px]">({ob.barsAge} شموع)</span>
                          <span className={`font-bold ${
                            (ob.freshnessScore ?? 80) >= 70 
                              ? 'text-emerald-400' 
                              : (ob.freshnessScore ?? 80) >= 40 
                              ? 'text-amber-400' 
                              : 'text-rose-400'
                          }`}>
                            {ob.freshnessScore ?? 80}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-[#0A0C10] rounded-full overflow-hidden border border-[#1A1D26]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (ob.freshnessScore ?? 80) >= 70
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : (ob.freshnessScore ?? 80) >= 40
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                              : 'bg-gradient-to-r from-rose-500 to-red-400'
                          }`}
                          style={{ width: `${ob.freshnessScore ?? 80}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FAIR VALUE GAPS (FVG) SECTION */}
        {(activeTab === 'both' || activeTab === 'fvg') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> فجوات القيمة العادلة (Fair Value Gaps - FVG)
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {fvgs.length} فجوات مرصودة
              </span>
            </div>

            <div className="space-y-2.5">
              {fvgs.map((fvg) => {
                const isBISI = fvg.type === 'BISI'; // Bullish
                return (
                  <div
                    key={fvg.id}
                    className={`p-3.5 rounded-lg border transition-all ${
                      isBISI
                        ? 'bg-cyan-950/10 border-cyan-900/30 hover:border-cyan-700/50'
                        : 'bg-indigo-950/10 border-indigo-900/30 hover:border-indigo-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            isBISI
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {isBISI ? 'فجوة صاعدة (BISI Imbalance)' : 'فجوة هابطة (SIBI Imbalance)'}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-[#0A0C10] px-1.5 py-0.5 rounded">
                          إطار {fvg.timeframe}
                        </span>
                      </div>

                      <span
                        className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                          fvg.status === 'Fresh'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                        }`}
                      >
                        {fvg.status === 'Fresh' ? 'طازجة (Fresh 🟢)' : `ممتلئة جزئياً (${fvg.fillPercentage}%)`}
                      </span>
                    </div>

                    {/* Pricing Range & Consequent Encroachment */}
                    <div className="grid grid-cols-3 gap-2 bg-[#0A0C10] p-2.5 rounded-md border border-[#1A1D26] my-2 text-center">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">قاع الفجوة</span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-white">
                          ${fvg.bottom.toFixed(2)}
                        </span>
                      </div>
                      <div className="border-x border-[#1A1D26]">
                        <span className="text-[10px] text-cyan-400 font-semibold block">
                          منتصف الفجوة (CE 50%)
                        </span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-cyan-300">
                          ${fvg.ce.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">قمة الفجوة</span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-white">
                          ${fvg.top.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Fill Bar */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                        <span>نسبة سحب السيولة وإعادة التوازن (Rebalancing)</span>
                        <span className="font-mono text-cyan-300">{fvg.fillPercentage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#0A0C10] rounded-full overflow-hidden border border-[#1A1D26]">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                          style={{ width: `${fvg.fillPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SMC Educational Footer Tip */}
      <div className="mt-4 p-3 bg-[#0A0C10] rounded-lg border border-[#1A1D26] text-xs text-zinc-400 flex items-start gap-2">
        <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-white">قاعدة التداول المؤسساتي:</strong> عند ارتداد السعر إلى منطقة فجوة القيمة العادلة
          (FVG)، يعتبر مستوى التعدي المتتالي (Consequent Encroachment - CE 50%) أفضل نقطة دخول دقيقة بأقل انعكاس ممكن،
          مع وضع أمر وقف الخسارة أسفل كتلة الأوامر المؤسساتية (Order Block) الداعمة.
        </p>
      </div>
    </div>
  );
};
