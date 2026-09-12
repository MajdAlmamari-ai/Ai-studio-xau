import React from 'react';
import { SMCAnalysis } from '../types';
import { Droplets, Shield, ArrowUp, ArrowDown, Magnet } from 'lucide-react';

interface LiquidityMapProps {
  analysis: SMCAnalysis;
}

export const LiquidityMap: React.FC<LiquidityMapProps> = ({ analysis }) => {
  const p = analysis.currentPrice;
  const bsl = analysis.bsl;
  const ssl = analysis.ssl;
  const res = analysis.resistance;
  const sup = analysis.support;

  const pivot = ((res + sup + p) / 3).toFixed(2);

  return (
    <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 flex flex-col shadow-lg">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
          <Magnet className="w-4 h-4 text-amber-400" />
          <span>خريطة سحب السيولة المؤسساتية (BSL / SSL)</span>
        </h2>
        <span className="text-xs font-mono text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-bold">
          XAUUSD: ${p.toFixed(2)}
        </span>
      </div>

      {/* Main Terminal Visualization Center */}
      <div className="relative min-h-[300px] bg-[#0A0C10] rounded-xl border border-[#1A1D26] flex flex-col justify-center items-center overflow-hidden p-6 select-none">
        
        {/* BSL (Buy-Side Liquidity) Top Line */}
        <div className="absolute top-8 left-0 right-0 border-t border-dashed border-rose-500/40 flex justify-between px-4 items-center">
          <span className="text-[10px] text-rose-400 font-mono uppercase bg-[#0A0C10] px-1.5 py-0.5 rounded font-bold">
            سيولة الشراء BSL: ${bsl.toFixed(2)}
          </span>
          <span className="text-[10px] text-rose-400/80 font-mono">
            أوامر وقف الشراء المتراكمة (+8.00$)
          </span>
        </div>

        {/* Resistance Level Indicator */}
        <div className="absolute top-18 left-4 right-4 flex justify-between items-center text-[10px] font-mono text-zinc-400 border-b border-[#1A1D26] pb-1">
          <span className="flex items-center gap-1 text-rose-400 font-semibold">
            <Shield className="w-3 h-3 text-rose-400" />
            <span>المقاومة المحورية: ${res.toFixed(2)}</span>
          </span>
          <span className="text-[10px] text-zinc-500">أوردر بلوك العرض: ${analysis.bearishOB.min} - ${analysis.bearishOB.max}</span>
        </div>

        {/* Center Gradient Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent my-3"></div>

        {/* Hero Price Center Display */}
        <div className="relative z-10 text-center py-2">
          <div className="text-5xl sm:text-6xl font-black font-mono text-white tracking-tight">
            ${p.toFixed(2)}
          </div>
          <div className="text-emerald-400 font-mono mt-1 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2">
            <span>+0.35% (+${(analysis.bsl - analysis.ssl > 0 ? '5.31' : '0.00')})</span>
            <span className="text-zinc-600">•</span>
            <span className="text-amber-400 text-xs tracking-wider">
              {analysis.bias === 'BULLISH' ? 'اتجاه صاعد' : analysis.bias === 'BEARISH' ? 'اتجاه هابط' : 'نطاق تجميعي'}
            </span>
          </div>
        </div>

        {/* Center Gradient Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent my-3"></div>

        {/* Support Level Indicator */}
        <div className="absolute bottom-18 left-4 right-4 flex justify-between items-center text-[10px] font-mono text-zinc-400 border-t border-[#1A1D26] pt-1">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>الدعم المحوري: ${sup.toFixed(2)}</span>
          </span>
          <span className="text-[10px] text-zinc-500">أوردر بلوك الطلب: ${analysis.bullishOB.min} - ${analysis.bullishOB.max}</span>
        </div>

        {/* SSL (Sell-Side Liquidity) Bottom Line */}
        <div className="absolute bottom-8 left-0 right-0 border-t border-dashed border-emerald-500/40 flex justify-between px-4 items-center">
          <span className="text-[10px] text-emerald-400 font-mono uppercase bg-[#0A0C10] px-1.5 py-0.5 rounded font-bold">
            سيولة البيع SSL: ${ssl.toFixed(2)}
          </span>
          <span className="text-[10px] text-emerald-400/80 font-mono">
            حوض سحب السيولة ووقف الخسارة (-6.00$)
          </span>
        </div>

        {/* Order Block Zone Overlay */}
        <div className="absolute top-1/2 left-0 right-0 h-[72px] -translate-y-1/2 bg-emerald-500/5 border-y border-emerald-500/10 pointer-events-none"></div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 uppercase font-bold transform rotate-90 origin-right font-mono pointer-events-none">
          منطقة الأوردر بلوك
        </div>
      </div>

      {/* Grid: Resistance, Pivot, Support */}
      <div className="grid grid-cols-3 gap-3 mt-3 font-mono text-center">
        <div className="bg-[#0A0C10] p-2.5 rounded-lg border border-[#1A1D26]">
          <p className="text-[10px] text-zinc-400">مقاومة العرض</p>
          <p className="text-sm sm:text-base font-bold text-white mt-0.5">${res.toFixed(2)}</p>
        </div>
        <div className="bg-[#0A0C10] p-2.5 rounded-lg border border-[#1A1D26]">
          <p className="text-[10px] text-amber-400">نقطة الارتكاز (Pivot)</p>
          <p className="text-sm sm:text-base font-bold text-amber-300 mt-0.5">${pivot}</p>
        </div>
        <div className="bg-[#0A0C10] p-2.5 rounded-lg border border-[#1A1D26]">
          <p className="text-[10px] text-zinc-400">دعم الطلب</p>
          <p className="text-sm sm:text-base font-bold text-white mt-0.5">${sup.toFixed(2)}</p>
        </div>
      </div>

      {/* Educational Micro-Legend */}
      <div className="mt-3 pt-2.5 border-t border-[#1A1D26] flex flex-wrap items-center justify-between text-[11px] text-zinc-400 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80 shrink-0"></span>
          <span>BSL: مصائد صانع السوق لأوامر وقف الشراء أعلى القمم السابقة</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 shrink-0"></span>
          <span>SSL: سحب السيولة أسفل القيعان لتفعيل تجميع صاعد مؤسساتي</span>
        </div>
      </div>
    </div>
  );
};
