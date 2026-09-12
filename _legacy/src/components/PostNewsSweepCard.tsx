import React from 'react';
import { Flame, Clock, Target, AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { PostNewsSweepData } from '../types';

interface PostNewsSweepCardProps {
  data?: PostNewsSweepData;
  currentPrice: number;
  onSimulateSweep?: (type: 'BULLISH' | 'BEARISH') => void;
}

export const PostNewsSweepCard: React.FC<PostNewsSweepCardProps> = ({
  data,
  currentPrice,
  onSimulateSweep,
}) => {
  const newsTitle = data?.activeNewsTitleAr || 'مؤشر أسعار المستهلكين الأمريكي (CPI) السنوي';
  const newsTime = data?.newsReleaseTime || 'اليوم - 15:30 (مرت 20 دقيقة)';
  const high = data?.newsCandleHigh || Number((currentPrice + 7.50).toFixed(2));
  const low = data?.newsCandleLow || Number((currentPrice - 8.20).toFixed(2));
  const sweepDetected = data?.sweepDetected ?? false;
  const sweepType = data?.sweepType || 'NONE';
  const signal = data?.actionableSignal || 'NO_SWEEP';
  const explanation = data?.explanationAr || 'السعر يختبر قيعان شمعة الأخبار مع مراقبة سحب السيولة.';

  const isBullishSweep = sweepType === 'BULLISH_SWEEP_REVERSAL';
  const isBearishSweep = sweepType === 'BEARISH_SWEEP_REVERSAL';

  return (
    <div className="bg-[#10131A] border border-[#1E2330] rounded-xl p-5 shadow-lg space-y-4">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2330] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              منطق الأحداث وسحب سيولة الأخبار (Post-News Sweep)
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400">
                قاعدة الـ 15 دقيقة
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              صناع السوق يتداولون رد فعل الأغبياء على الخبر: سحب القمة أو القاع ثم الانعكاس
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{newsTime}</span>
        </div>
      </div>

      {/* News Candle Identification Box */}
      <div className="bg-[#151923] border border-[#232938] rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="text-xs font-semibold text-gray-300">
            شمعة الخبر النشطة: <span className="text-amber-300 font-bold">{newsTitle}</span>
          </div>
          <div className="text-[11px] px-2 py-0.5 rounded bg-[#1B2130] text-gray-300 font-mono">
            نطاق الشمعة: ${(high - low).toFixed(2)} دولار
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* High */}
          <div className="bg-[#1A202D] border border-rose-500/20 p-2.5 rounded-lg">
            <div className="text-[11px] text-gray-400 mb-0.5 flex items-center justify-between">
              <span>قمة شمعة الخبر (News High)</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-base font-bold font-mono text-rose-400">${high.toFixed(2)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">حاجز مصيدة الثيران (Buy Sweep)</div>
          </div>

          {/* Current Price */}
          <div className="bg-[#1A202D] border border-amber-500/20 p-2.5 rounded-lg">
            <div className="text-[11px] text-gray-400 mb-0.5 flex items-center justify-between">
              <span>السعر الفوري الحالي</span>
              <Target className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-base font-bold font-mono text-white">${currentPrice.toFixed(2)}</div>
            <div className="text-[10px] text-amber-400 mt-0.5">داخل نطاق شمعة الخبر</div>
          </div>

          {/* Low */}
          <div className="bg-[#1A202D] border border-emerald-500/20 p-2.5 rounded-lg">
            <div className="text-[11px] text-gray-400 mb-0.5 flex items-center justify-between">
              <span>قاع شمعة الخبر (News Low)</span>
              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-base font-bold font-mono text-emerald-400">${low.toFixed(2)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">حاجز مصيدة الدببة (Sell Sweep)</div>
          </div>
        </div>
      </div>

      {/* Market Maker Signal Result */}
      <div className={`p-4 rounded-lg border ${
        isBullishSweep
          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
          : isBearishSweep
          ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          : 'bg-[#151923] border-[#222838] text-gray-300'
      }`}>
        <div className="flex items-start gap-3">
          {isBullishSweep ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : isBearishSweep ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div className="text-xs font-bold flex items-center gap-2">
              <span>حالة سحب السيولة:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                isBullishSweep 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : isBearishSweep 
                  ? 'bg-rose-500/20 text-rose-400' 
                  : 'bg-gray-800 text-gray-300'
              }`}>
                {sweepType === 'BULLISH_SWEEP_REVERSAL' 
                  ? 'سحب سيولة بيع ثم ارتداد صاعد (Bullish Sweep Reversal)' 
                  : sweepType === 'BEARISH_SWEEP_REVERSAL' 
                  ? 'سحب سيولة شراء ثم ارتداد هابط (Bearish Sweep Reversal)' 
                  : 'بانتظار سحب قمة أو قاع الشمعة'}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-gray-200">
              {explanation}
            </p>
          </div>
        </div>
      </div>

      {/* Rules & Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="bg-[#141822] p-3 rounded-lg border border-[#1F2533] space-y-1.5">
          <div className="font-bold text-amber-400">قواعد صناع السوق بعد الأخبار:</div>
          <ul className="list-disc list-inside text-gray-400 space-y-1 text-[11px] leading-relaxed">
            <li>انتظار 15 دقيقة بعد صدور الخبر (عدم ملاحقة الشمعة الأولى).</li>
            <li>تحديد قمة وقاع الشمعة على فريم 1M أو 5M.</li>
            <li>إذا اخترق السعر القمة وعاد للإغلاق داخلها خلال 15 دقيقة = فرصة بيع ذهبية.</li>
            <li>إذا كسر السعر القاع وعاد للإغلاق داخله خلال 15 دقيقة = فرصة شراء ذهبية.</li>
          </ul>
        </div>

        <div className="bg-[#141822] p-3 rounded-lg border border-[#1F2533] flex flex-col justify-between">
          <div>
            <div className="font-bold text-blue-400 mb-1">محاكاة فخ صناع السوق اللحظي:</div>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
              اختبر استجابة النظام عند قيام السعر بسحب قاع أو قمة الشمعة الإخبارية:
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSimulateSweep && onSimulateSweep('BULLISH')}
              className="flex-1 py-1.5 px-2.5 rounded bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition"
            >
              محاكاة سحب القاع (شراء)
            </button>
            <button
              onClick={() => onSimulateSweep && onSimulateSweep('BEARISH')}
              className="flex-1 py-1.5 px-2.5 rounded bg-rose-900/30 hover:bg-rose-900/50 border border-rose-500/30 text-rose-400 text-xs font-semibold transition"
            >
              محاكاة سحب القمة (بيع)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
