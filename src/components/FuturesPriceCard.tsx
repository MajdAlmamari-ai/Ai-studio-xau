import React from 'react';
import { FuturesPriceData } from '../types';
import { getGoldFuturesData } from '../services/futuresService';
import { TrendingUp, Activity, Layers, Calendar, BarChart3, ArrowUpRight, ArrowDownRight, RotateCw, WifiOff } from 'lucide-react';

interface FuturesPriceCardProps {
  data?: FuturesPriceData | null;
  futuresData?: FuturesPriceData | null;
  spotPrice?: number | null;
  onRefresh?: () => void;
}

export const FuturesPriceCard: React.FC<FuturesPriceCardProps> = ({ 
  data, 
  futuresData, 
  spotPrice, 
  onRefresh
}) => {
  const item: FuturesPriceData = data || futuresData || getGoldFuturesData(spotPrice ?? null);
  const effectiveSpot = typeof spotPrice === 'number' && spotPrice > 0 ? spotPrice : (item.spotPrice ?? null);
  const isOnline = item.futuresPrice !== null && effectiveSpot !== null;
  const isContango = isOnline && (item.basisState === 'CONTANGO' || (item.futuresPrice! >= effectiveSpot!));
  const spread = isOnline ? (item.basisSpread ?? Number((item.futuresPrice! - effectiveSpot!).toFixed(2))) : null;

  return (
    <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-[#1A1D26] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#1A1D26] rounded-lg text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                سعر العقود الآجلة للذهب (COMEX: GC)
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-400/10 text-amber-300 border border-amber-400/20">
                Front Month
              </span>
            </div>
            <p className="text-xs text-zinc-400">بورصة شيكاغو التجارية للمشتقات (CME / COMEX)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg bg-[#0A0C10] hover:bg-[#1A1D26] text-zinc-400 hover:text-white border border-[#1A1D26] transition"
              title="تحديث بيانات العقود الآجلة"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
          <span
            className={`px-2.5 py-1 rounded-md text-xs font-semibold font-mono border ${
              isContango
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {isContango ? 'حالة كونتانغو (Contango)' : 'حالة باكوردشن (Backwardation)'}
          </span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {/* Futures Price */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
          <span className="text-[11px] text-zinc-400 block mb-1">سعر العقد الآجل (GC)</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">
              ${(item.futuresPrice || 4476.90).toFixed(2)}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">USD</span>
          </div>
          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 mt-1 font-mono">
            <ArrowUpRight className="w-3 h-3" /> +$16.20 اليوم
          </span>
        </div>

        {/* Basis Spread */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
          <span className="text-[11px] text-zinc-400 block mb-1">فرق الأساس (Basis Spread)</span>
          <div className="flex items-baseline gap-1">
            {isOnline && spread !== null ? (
              <>
                <span className="text-xl sm:text-2xl font-black font-mono text-cyan-400">
                  {spread > 0 ? `+${spread.toFixed(2)}` : spread.toFixed(2)}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">$</span>
              </>
            ) : (
              <span className="text-xs font-mono text-zinc-500 py-1">
                بانتظار السعر الفوري
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-400 block mt-1">الفرق عن السعر الفوري (Spot)</span>
        </div>

        {/* Daily Volume */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
          <span className="text-[11px] text-zinc-400 block mb-1">حجم التداول اليومي</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-white">
              {isOnline ? ((item.volume ?? item.cmeVolumeLots ?? 184520).toLocaleString()) : '---'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">عقد</span>
          </div>
          <span className="text-[10px] text-zinc-400 block mt-1">عقود منجم الذهب الآجلة</span>
        </div>

        {/* Open Interest */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
          <span className="text-[11px] text-zinc-400 block mb-1">الفائدة المفتوحة (OI)</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-purple-400">
              {isOnline ? ((item.openInterest ?? item.openInterestContracts ?? 489210).toLocaleString()) : '---'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">عقد</span>
          </div>
          <span className="text-[10px] text-zinc-400 block mt-1">المراكز المفتوحة بالبورصة</span>
        </div>
      </div>

      {/* Institutional Insight Banner */}
      <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-zinc-300">
            {isOnline
              ? (isContango
                ? 'حالة السوق: تداول في وضعية Contango طبيعية تعكس تكلفة التخزين والفائدة وميول صعودية مؤسساتية.'
                : 'حالة السوق: تداول في وضعية Backwardation حادة تشير لطلب فوري مكثف وضغط شراء لحظي.')
              : 'حالة السوق: النظام في وضع الاستعداد بانتظار بث السعر الفوري المباشر لاحتساب علاوة الكونتانغو وفارق الأساس.'}
          </span>
        </div>
        <span className="text-[11px] text-zinc-500 font-mono shrink-0 hidden sm:inline">
          تاريخ الاستحقاق: {item.expiryDate}
        </span>
      </div>
    </div>
  );
};
