import React, { useState } from 'react';
import { SMCScenario } from '../types';
import { getSMCScenarios } from '../data/scenariosData';
import { Compass, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, ShieldCheck, Check, ArrowRight } from 'lucide-react';

interface ScenariosCardProps {
  scenarios?: SMCScenario[];
  currentPrice?: number;
  onSelectScenario?: (scenario: SMCScenario) => void;
  onApplyScenario?: (scenario: SMCScenario) => void;
}

export const ScenariosCard: React.FC<ScenariosCardProps> = ({ 
  scenarios, 
  currentPrice = 4478.50,
  onSelectScenario, 
  onApplyScenario 
}) => {
  const list: SMCScenario[] = (scenarios && scenarios.length > 0)
    ? scenarios
    : getSMCScenarios(
        currentPrice,
        Number((currentPrice + 8.0).toFixed(2)),
        Number((currentPrice - 6.0).toFixed(2)),
        Number((currentPrice + 4.0).toFixed(2)),
        Number((currentPrice - 4.0).toFixed(2))
      );

  const [selectedId, setSelectedId] = useState<string>(list[0]?.id || '');

  const handleSelect = (sc: SMCScenario) => {
    setSelectedId(sc.id);
    if (onSelectScenario) onSelectScenario(sc);
    if (onApplyScenario) onApplyScenario(sc);
  };

  return (
    <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-[#1A1D26] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#1A1D26] rounded-lg text-emerald-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              سيناريوهات التداول المؤسساتي المحتملة (SMC Scenarios)
            </h3>
            <p className="text-xs text-zinc-400">
              خرائط الحركة التكتيكية وفق سلوك صانع السوق والاحتمالات الشرطية لحركة السعر
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md self-start sm:self-auto">
          تحديث ديناميكي مباشر
        </span>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {list.map((sc) => {
          const isSelected = selectedId === sc.id;
          const isBull = sc.type === 'BULLISH_EXPANSION';
          const isBear = sc.type === 'BEARISH_BREAKDOWN';

          return (
            <div
              key={sc.id}
              onClick={() => handleSelect(sc)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-[#1A1D26]/80 border-amber-400 ring-1 ring-amber-400/50 shadow-xl'
                  : 'bg-[#0A0C10] border-[#1A1D26] hover:border-zinc-700'
              }`}
            >
              <div>
                {/* Header Badge & Probability */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    {isBull ? (
                      <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                        <TrendingUp className="w-4 h-4" />
                      </span>
                    ) : isBear ? (
                      <span className="p-1 rounded bg-rose-500/20 text-rose-400">
                        <TrendingDown className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="p-1 rounded bg-amber-500/20 text-amber-400">
                        <RefreshCw className="w-4 h-4" />
                      </span>
                    )}
                    <span
                      className={`text-xs font-bold ${
                        isBull ? 'text-emerald-400' : isBear ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    >
                      {isBull ? 'توسع صاعد' : isBear ? 'كسر هبوطي' : 'نطاق تجميعي'}
                    </span>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-xs text-zinc-400 block text-[10px]">الاحتمالية</span>
                    <span
                      className={`text-sm font-bold ${
                        sc.probability >= 60
                          ? 'text-emerald-400'
                          : sc.probability >= 30
                          ? 'text-amber-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {sc.probability}%
                    </span>
                  </div>
                </div>

                {/* Scenario Title */}
                <h4 className="text-sm font-bold text-white mb-2.5 leading-snug">{sc.titleAr}</h4>

                {/* Trigger Condition */}
                <div className="bg-[#12141B] p-2.5 rounded-lg border border-[#1A1D26] mb-3 text-xs">
                  <span className="text-[10px] text-amber-400 font-semibold block mb-1">
                    شرط تفعيل السيناريو (Trigger):
                  </span>
                  <p className="text-zinc-300 leading-relaxed">{sc.triggerConditionAr}</p>
                </div>

                {/* Parameters */}
                <div className="space-y-1.5 text-xs font-mono mb-3">
                  <div className="flex justify-between py-1 border-b border-[#1A1D26]/60">
                    <span className="text-zinc-400">نطاق الدخول المقترح:</span>
                    <span className="font-bold text-white">
                      ${sc.entryRange.min.toFixed(2)} - ${sc.entryRange.max.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1A1D26]/60">
                    <span className="text-rose-400">مستوى إبطال السيناريو (SL):</span>
                    <span className="font-bold text-rose-300">${sc.invalidationLevel.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1A1D26]/60">
                    <span className="text-emerald-400">الأهداف (TPs):</span>
                    <span className="font-bold text-emerald-300">
                      {sc.targetTakeProfits.map((tp) => `$${tp}`).join(' ← ')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-400">نسبة العائد للمخاطرة (RR):</span>
                    <span className="font-bold text-cyan-400">{sc.riskReward}</span>
                  </div>
                </div>

                {/* Rationale */}
                <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">{sc.rationaleAr}</p>
              </div>

              {/* Selection Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(sc);
                }}
                className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-400 text-black shadow-md'
                    : 'bg-[#1A1D26] text-zinc-300 hover:text-white hover:bg-[#232733]'
                }`}
              >
                {isSelected ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> تم تفعيل هذا السيناريو
                  </>
                ) : (
                  <>
                    محاكاة واختبار السيناريو <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
