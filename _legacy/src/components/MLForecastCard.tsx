import React, { useState } from 'react';
import { MLPrediction } from '../types';
import { calculateMLPredictions } from '../services/mlService';
import { Cpu, TrendingUp, TrendingDown, Target, BarChart2, ShieldCheck, Zap, Activity, RotateCw } from 'lucide-react';

interface MLForecastCardProps {
  predictions?: Record<'15M' | '1H' | '4H' | '1D', MLPrediction> | null;
  currentPrice?: number;
  onRefresh?: () => void;
}

export const MLForecastCard: React.FC<MLForecastCardProps> = ({ 
  predictions,
  currentPrice = 4478.50,
  onRefresh
}) => {
  const [selectedTf, setSelectedTf] = useState<'15M' | '1H' | '4H' | '1D'>('1H');
  const safePredictions = predictions && predictions['1H'] 
    ? predictions 
    : calculateMLPredictions(currentPrice, 'BULLISH');
  const currentPred = safePredictions[selectedTf] || safePredictions['1H'];

  const isUp = currentPred.direction === 'UP';

  return (
    <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg relative">
      {/* Header & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-[#1A1D26] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#1A1D26] rounded-lg text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                نموذج تعلم الآلة للتنبؤ بمسار الذهب (Machine Learning Predictive Engine)
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                XGBoost + TimeSeries
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              توقعات انحدار إحصائي وتدفق أوامر مع شريط ثقة مونت كارلو (Monte Carlo Confidence Bands)
            </p>
          </div>
        </div>

        {/* Timeframe Buttons & Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg bg-[#0A0C10] hover:bg-[#1A1D26] text-zinc-400 hover:text-white border border-[#1A1D26] transition"
              title="تحديث نموذج التنبؤات"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex items-center bg-[#0A0C10] p-1 rounded-lg border border-[#1A1D26]">
            {(['15M', '1H', '4H', '1D'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTf(tf)}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-md transition-colors ${
                  selectedTf === tf
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tf === '15M' ? '15 دقيقة' : tf === '1H' ? '1 ساعة' : tf === '4H' ? '4 ساعات' : 'يومي 1D'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Prediction Highlight */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {/* Predicted Target Box */}
        <div className="bg-[#0A0C10] p-4 rounded-xl border border-[#1A1D26] flex flex-col justify-between">
          <div>
            <span className="text-xs text-zinc-400 block mb-1">
              السعر المتوقع للإطار ({selectedTf})
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-400">
                ${currentPred.predictedPrice.toFixed(2)}
              </span>
              <span
                className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {currentPred.predictedChangePct > 0 ? `+${currentPred.predictedChangePct}%` : `${currentPred.predictedChangePct}%`}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#1A1D26] flex items-center justify-between text-xs">
            <span className="text-zinc-400">السعر الحالي:</span>
            <span className="font-mono font-bold text-white">${currentPred.currentPrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Confidence Interval Box */}
        <div className="bg-[#0A0C10] p-4 rounded-xl border border-[#1A1D26] flex flex-col justify-between">
          <div>
            <span className="text-xs text-zinc-400 block mb-1">
              نطاق الثقة الإحصائي (95% Confidence Band)
            </span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-[#12141B] p-2 rounded border border-[#1A1D26]">
                <span className="text-[10px] text-zinc-500 block">الحد الأدنى</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-rose-300">
                  ${currentPred.lowerConfidenceBand.toFixed(2)}
                </span>
              </div>
              <div className="bg-[#12141B] p-2 rounded border border-[#1A1D26]">
                <span className="text-[10px] text-zinc-500 block">الحد الأقصى</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-emerald-300">
                  ${currentPred.upperConfidenceBand.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#1A1D26] flex items-center justify-between text-xs">
            <span className="text-zinc-400">درجة دقة التنبؤ:</span>
            <span className="font-mono font-bold text-cyan-300">{currentPred.confidenceScore}%</span>
          </div>
        </div>

        {/* Model Accuracy & Metrics */}
        <div className="bg-[#0A0C10] p-4 rounded-xl border border-[#1A1D26] flex flex-col justify-between">
          <div>
            <span className="text-xs text-zinc-400 block mb-1">مقاييس كفاءة نموذج ML</span>
            <div className="space-y-1.5 text-xs font-mono mt-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">الخوارزمية:</span>
                <span className="text-white text-[11px]">XGBoost Gradient Boost</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">معامل التحديد (R²):</span>
                <span className="text-emerald-400 font-bold">{currentPred.modelInfo.r2Score}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">متوسط الخطأ (RMSE):</span>
                <span className="text-amber-400 font-bold">${currentPred.modelInfo.rmse}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#1A1D26] flex items-center justify-between text-[11px] text-zinc-500">
            <span>بيانات التدريب:</span>
            <span className="font-mono text-zinc-300">{(currentPred.modelInfo?.datasetPoints ?? 142850).toLocaleString('ar-EG')} نقطة</span>
          </div>
        </div>
      </div>

      {/* Feature Importance Bar */}
      <div className="bg-[#0A0C10] p-3.5 rounded-xl border border-[#1A1D26]">
        <span className="text-xs font-bold text-zinc-300 block mb-3 flex items-center gap-1.5">
          <BarChart2 className="w-4 h-4 text-cyan-400" />
          أوزان العوامل في النموذج (Feature Importance Weights)
        </span>

        <div className="space-y-2.5">
          {currentPred.features.map((feat, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">{feat.nameAr}</span>
                <span className="font-mono text-cyan-400 font-bold">{feat.weight}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#12141B] rounded-full overflow-hidden border border-[#1A1D26]">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-indigo-400 rounded-full"
                  style={{ width: `${feat.weight * 2}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
