import React, { useState } from 'react';
import { BarChart2, Layers, RefreshCw, Zap } from 'lucide-react';
import { CandlestickChartCard } from '../CandlestickChartCard';

interface ChartsTabProps {
  currentPrice: number;
}

export const ChartsTab: React.FC<ChartsTabProps> = ({ currentPrice }) => {
  const [basisDiff, setBasisDiff] = useState<number>(10.0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const spotEstimated = currentPrice;
  const futuresEstimated = Number((currentPrice + basisDiff).toFixed(2));

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetch('/api/fusion/analysis?timeframe=15m')
      .then((res) => res.json())
      .then((data) => {
        if (data.basisAnalysis?.current) {
          setBasisDiff(data.basisAnalysis.current);
        }
      })
      .catch(() => {})
      .finally(() => setIsRefreshing(false));
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">الرسوم البيانية المزدوجة (Side-by-Side Charts)</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Spot vs Futures
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              مقارنة بصرية متزامنة بين شارت الذهب الفوري (OANDA) وعقود الذهب الآجلة (COMEX GC)
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#161B26] hover:bg-[#1E2536] text-zinc-200 text-xs font-semibold border border-[#2A3142] transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          <span>تحديث المقارنة</span>
        </button>
      </div>

      {/* Side-by-Side Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Spot Chart */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <h3 className="font-bold text-white text-sm">شارت السعر الفوري (XAU/USD Spot)</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold bg-[#11141D] px-2 py-0.5 rounded border border-[#1E2333]">
              OANDA:XAUUSD (${spotEstimated.toFixed(2)})
            </span>
          </div>

          <div className="bg-[#0D1017] rounded-xl border border-[#1E2333] overflow-hidden">
            <CandlestickChartCard currentPrice={spotEstimated} />
          </div>
        </div>

        {/* Right: Futures Chart */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <h3 className="font-bold text-white text-sm">شارت عقود الذهب الآجلة (COMEX GC)</h3>
            </div>
            <span className="text-xs font-mono text-amber-400 font-bold bg-[#11141D] px-2 py-0.5 rounded border border-[#1E2333]">
              COMEX:GC1! (${futuresEstimated.toFixed(2)})
            </span>
          </div>

          <div className="bg-[#0D1017] rounded-xl border border-[#1E2333] overflow-hidden">
            <CandlestickChartCard currentPrice={futuresEstimated} />
          </div>
        </div>
      </div>

      {/* Bottom: Basis-Adjusted Overlay Strip */}
      <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">تطابق الفارق السعري (Basis-Adjusted Overlay)</h4>
              <p className="text-xs text-zinc-400">
                الفارق الحالي بين العقود الآجلة والسعر الفوري: <span className="font-mono text-amber-400 font-bold">${basisDiff.toFixed(2)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-[#0A0C10] px-3 py-2 rounded-lg border border-[#1E2333]">
              <span className="text-zinc-400 block font-sans text-[10px]">Spot (OANDA)</span>
              <span className="text-emerald-400 font-bold text-sm">${spotEstimated.toFixed(2)}</span>
            </div>
            <span className="text-zinc-600 font-sans">+</span>
            <div className="bg-[#0A0C10] px-3 py-2 rounded-lg border border-[#1E2333]">
              <span className="text-zinc-400 block font-sans text-[10px]">Basis</span>
              <span className="text-amber-400 font-bold text-sm">${basisDiff.toFixed(2)}</span>
            </div>
            <span className="text-zinc-600 font-sans">=</span>
            <div className="bg-[#0A0C10] px-3 py-2 rounded-lg border border-[#1E2333]">
              <span className="text-zinc-400 block font-sans text-[10px]">Futures (COMEX)</span>
              <span className="text-amber-300 font-bold text-sm">${futuresEstimated.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
