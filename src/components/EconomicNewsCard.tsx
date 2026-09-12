import React from 'react';
import { EconomicNewsItem } from '../types';
import { GOLD_ECONOMIC_NEWS } from '../services/newsService';
import { Newspaper, Flame, TrendingUp, TrendingDown, Clock, AlertCircle, ExternalLink, Globe, RotateCw } from 'lucide-react';

interface EconomicNewsCardProps {
  news?: EconomicNewsItem[];
  newsItems?: EconomicNewsItem[];
  onRefresh?: () => void;
}

export const EconomicNewsCard: React.FC<EconomicNewsCardProps> = ({ news, newsItems, onRefresh }) => {
  const list = (news && news.length > 0) 
    ? news 
    : (newsItems && newsItems.length > 0) 
      ? newsItems 
      : GOLD_ECONOMIC_NEWS;

  return (
    <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-[#1A1D26] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#1A1D26] rounded-lg text-rose-400">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                الأخبار الاقتصادية والمؤثرات الجوهرية على الذهب
              </h3>
              <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Flame className="w-3 h-3 animate-pulse" /> عالي التأثير
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              رصد بيانات التضخم، الفيدرالي الأمريكي (FOMC)، مؤشر الدولار (DXY)، ومشتريات البنوك المركزية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg bg-[#0A0C10] hover:bg-[#1A1D26] text-zinc-400 hover:text-white border border-[#1A1D26] transition flex items-center gap-1 font-sans"
              title="تحديث الأخبار"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تحديث</span>
            </button>
          )}
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>تحديث فوري عبر الباك-إيند</span>
        </div>
      </div>

      {/* News Items List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((item) => {
          const isHigh = item.impact === 'HIGH';
          const isBull = item.directionalBias === 'BULLISH';
          const isBear = item.directionalBias === 'BEARISH';

          return (
            <div
              key={item.id}
              className="bg-[#0A0C10] p-4 rounded-xl border border-[#1A1D26] hover:border-zinc-700 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Meta Bar */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-zinc-500" /> {item.source}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        isHigh
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {isHigh ? 'تأثير قوي ⚡' : 'تأثير متوسط'}
                    </span>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        isBull
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : isBear
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {isBull ? 'إيجابي للذهب ▲' : isBear ? 'سلبي للذهب ▼' : 'تذبذب وتقلب ◈'}
                    </span>
                  </div>
                </div>

                {/* News Title */}
                <h4 className="text-sm font-bold text-white mb-2 leading-snug">{item.titleAr}</h4>

                {/* Key Numbers (Actual / Forecast / Previous) */}
                {(item.actual || item.forecast || item.previous) && (
                  <div className="grid grid-cols-3 gap-2 bg-[#12141B] p-2 rounded-lg border border-[#1A1D26] my-2.5 text-center text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">السابق</span>
                      <span className="text-zinc-300">{item.previous || '-'}</span>
                    </div>
                    <div className="border-x border-[#1A1D26]">
                      <span className="text-[10px] text-amber-400 block">المتوقع</span>
                      <span className="text-amber-300 font-bold">{item.forecast || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400 block">الفعلي</span>
                      <span className="text-emerald-400 font-bold">{item.actual || 'قيد الصدور'}</span>
                    </div>
                  </div>
                )}

                {/* SMC Impact Breakdown */}
                <p className="text-xs text-zinc-300 leading-relaxed bg-[#1A1D26]/40 p-2.5 rounded-lg border border-[#1A1D26]/60">
                  <span className="font-bold text-amber-400 block mb-0.5">انعكاس الخبر على حركة الذهب:</span>
                  {item.goldImpactAr}
                </p>
              </div>

              {/* Time Tag */}
              <div className="pt-3 border-t border-[#1A1D26] mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                <span className="font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-400" /> {item.time}
                </span>
                <span className="text-zinc-400 font-mono">XAUUSD Direct Impact</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
