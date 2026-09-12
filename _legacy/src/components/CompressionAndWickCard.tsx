import React from 'react';
import { Gauge, ShieldAlert, Sparkles, AlertCircle, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { CompressionMetrics, WickFilterMetrics, OrderBlockDetail } from '../types';
import { ZoneFreshnessChart } from './ZoneFreshnessChart';

interface CompressionAndWickCardProps {
  compression?: CompressionMetrics;
  wickFilter?: WickFilterMetrics;
  orderBlocks?: OrderBlockDetail[];
  currentPrice: number;
}

export const CompressionAndWickCard: React.FC<CompressionAndWickCardProps> = ({
  compression,
  wickFilter,
  orderBlocks,
  currentPrice,
}) => {
  // Compression metrics
  const isCompressed = compression?.isCompressed ?? true;
  const currentAtr = compression?.current1hATR || 3.85;
  const lowestAtr = compression?.lowestAtr20Period || 3.40;
  const compressionRatio = compression?.compressionRatioPct || 88.3;

  // Wick metrics
  const maxWick = wickFilter?.maxWick10Bars || 4.20;
  const safeBuffer = wickFilter?.calculatedWickBuffer || 9.98;
  const dynamicSl = wickFilter?.dynamicStopLoss || (currentPrice - safeBuffer);
  const rrNumeric = wickFilter?.riskRewardNumeric || 2.45;
  const isRRValid = wickFilter?.isRRValid ?? true;
  const verdict = wickFilter?.verdict || 'APPROVED';

  return (
    <div className="bg-[#10131A] border border-[#1E2330] rounded-xl p-5 shadow-lg space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2330] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              الضغط السعري وفلتر الذيول (Compression & Wick Protection)
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                إدارة مخاطر مؤسساتية
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              الكشف عن انفجار الزنبرك وحساب وقف الخسارة الديناميكي وحماية نضارة المناطق
            </p>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns for Compression & Wick Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Module 1: Price Compression (Spring Coil Engine) */}
        <div className="bg-[#151923] border border-[#232938] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              1. خوارزمية كشف "الضغط السعري" (Spring Coil Engine)
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-bold ${
              isCompressed ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-800 text-gray-300'
            }`}>
              {isCompressed ? 'الزنبرك مشدود (Coiled)' : 'نطاق تذبذب معتاد'}
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            إذا ضاق نطاق التداول (ATR فريم 1H) إلى أدنى مستوى في آخر 20 شمعة، فهذا يعني أن صناع السوق يقومون بضغط السعر قبل حدوث انفجار اتجاهي عنيف.
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#1A202E] p-2 rounded-lg border border-gray-800">
              <div className="text-[10px] text-gray-400">ATR 1H الحالي</div>
              <div className="text-sm font-bold font-mono text-white mt-0.5">${currentAtr.toFixed(2)}</div>
            </div>
            <div className="bg-[#1A202E] p-2 rounded-lg border border-gray-800">
              <div className="text-[10px] text-gray-400">أدنى ATR بـ 20 شمعة</div>
              <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">${lowestAtr.toFixed(2)}</div>
            </div>
            <div className="bg-[#1A202E] p-2 rounded-lg border border-gray-800">
              <div className="text-[10px] text-gray-400">مؤشر الانضغاط</div>
              <div className="text-sm font-bold font-mono text-cyan-300 mt-0.5">{compressionRatio}%</div>
            </div>
          </div>

          <div className="bg-[#121620] p-3 rounded-lg border border-[#1E2434] text-xs text-gray-300 leading-relaxed">
            <span className="font-semibold text-amber-400">سلوك النظام: </span>
            {compression?.recommendationAr || 'النظام في وضع الترقب الحذر: ينتظر كسر النطاق السعري بكسر هيكل (Minor BOS) ثم الدخول فوراً مع اتجاه الانفجار السعري.'}
          </div>
        </div>

        {/* Module 2: Wick Filter & Stop Loss Protection */}
        <div className="bg-[#151923] border border-[#232938] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              2. فلتر الانحراف المعياري للذيل (Wick Filter)
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-bold ${
              isRRValid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {isRRValid ? 'R:R معتمد (≥ 1:2.0)' : 'مرفوض: ذيول عنيفة'}
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            حماية الصفقات من ضرب الوقف بالذيول الخاطفة: وقف الخسارة = (أقصى ذيل في 10 شموع) + (1.5 × ATR). إذا جعل الوقف نسبة R:R أقل من 1:2، <span className="text-rose-400 font-bold">يمنع النظام الدخول نهائياً</span>.
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#1A202E] p-2 rounded-lg border border-gray-800">
              <div className="text-[10px] text-gray-400">أقصى ذيل (10 شموع)</div>
              <div className="text-sm font-bold font-mono text-rose-300 mt-0.5">${maxWick.toFixed(2)}</div>
            </div>
            <div className="bg-[#1A202E] p-2 rounded-lg border border-gray-800">
              <div className="text-[10px] text-gray-400">هامش الوقف المحمي</div>
              <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">${safeBuffer.toFixed(2)}</div>
            </div>
            <div className="bg-[#1A202E] p-2 rounded-lg border border-gray-800">
              <div className="text-[10px] text-gray-400">العائد للمخاطرة R:R</div>
              <div className={`text-sm font-bold font-mono mt-0.5 ${isRRValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                1:{rrNumeric}
              </div>
            </div>
          </div>

          <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
            isRRValid 
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-start gap-2">
              {isRRValid ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{wickFilter?.explanationAr || 'تم احتساب وقف الخسارة المحمي لضمان عدم ضرب الوقف بالذيول المؤسساتية.'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module 3: Zone Freshness & Erosion Meter with Recharts */}
      <ZoneFreshnessChart 
        orderBlocks={orderBlocks || []} 
        currentPrice={currentPrice} 
      />
    </div>
  );
};
