import React from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { ScenarioProjection } from '../types';

interface ScenarioProjectionCardProps {
  scenarioData: Record<'15M' | '1H' | '4H' | '1D', ScenarioProjection> | null;
  currentPrice: number | null;
}

export const ScenarioProjectionCard: React.FC<ScenarioProjectionCardProps> = ({
  scenarioData,
  currentPrice,
}) => {
  if (!scenarioData) {
    return (
      <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-2">
          توقع السيناريو (Scenario Projection)
        </h3>
        <p className="text-xs text-zinc-400">
          بانتظار بيانات ATR...
        </p>
      </div>
    );
  }

  const timeframes: Array<'15M' | '1H' | '4H' | '1D'> = ['15M', '1H', '4H', '1D'];

  const getIcon = (dir: 'UP' | 'DOWN' | 'NEUTRAL') => {
    if (dir === 'UP') return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (dir === 'DOWN') return <TrendingDown className="w-4 h-4 text-rose-400" />;
    return <Minus className="w-4 h-4 text-zinc-400" />;
  };

  const getColor = (dir: 'UP' | 'DOWN' | 'NEUTRAL') => {
    if (dir === 'UP') return 'text-emerald-400';
    if (dir === 'DOWN') return 'text-rose-400';
    return 'text-zinc-400';
  };

  return (
    <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">
          توقع السيناريو (Scenario Projection)
        </h3>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
          ATR-Based
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {timeframes.map((tf) => {
          const proj = scenarioData[tf];
          return (
            <div
              key={tf}
              className="bg-[#0A0C10] border border-[#1A1D26] rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-zinc-300">
                  {tf}
                </span>
                {getIcon(proj.direction)}
              </div>

              <div className={`text-lg font-bold font-mono ${getColor(proj.direction)}`}>
                ${proj.projectedPrice.toFixed(2)}
              </div>

              <div className={`text-[10px] font-mono mt-1 ${getColor(proj.direction)}`}>
                {proj.projectedChangePct >= 0 ? '+' : ''}
                {proj.projectedChangePct.toFixed(3)}%
              </div>

              <div className="mt-2 pt-2 border-t border-[#1A1D26] text-[10px] text-zinc-500 font-mono space-y-0.5">
                <div className="flex justify-between">
                  <span>النطاق:</span>
                  <span className="text-zinc-400">
                    ${proj.rangeLower.toFixed(2)} — ${proj.rangeUpper.toFixed(2)}
                  </span>
                </div>
                {proj.atrUsed !== null && (
                  <div className="flex justify-between">
                    <span>ATR:</span>
                    <span className="text-zinc-400">${proj.atrUsed.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-[#1A1D26] flex items-start gap-2 text-[10px] text-zinc-500">
        <Info className="w-3 h-3 mt-0.5 shrink-0" />
        <p>
          توقع سيناريو مبني على ATR. ليس نموذج تعلم آلي. للعرض البحثي فقط.
        </p>
      </div>
    </div>
  );
};
