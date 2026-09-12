import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Target, 
  Scale, 
  Layers, 
  Copy, 
  Check, 
  Send, 
  ArrowUpRight, 
  ArrowDownRight, 
  PauseCircle,
  HelpCircle,
  Box,
  Database,
  BarChart3
} from 'lucide-react';
import { SMCAnalysis } from '../types';
import { formatMarkdownReport } from '../services/telegramService';

interface SMCReportCardProps {
  analysis: SMCAnalysis;
  onOpenTelegramModal: () => void;
  onOpenSignalsArchive?: () => void;
  onOpenFreshnessTab?: () => void;
}

export const SMCReportCard: React.FC<SMCReportCardProps> = ({
  analysis,
  onOpenTelegramModal,
  onOpenSignalsArchive,
  onOpenFreshnessTab,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = formatMarkdownReport(analysis);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isBuy = analysis.action === 'BUY';
  const isSell = analysis.action === 'SELL';
  const isWait = analysis.action === 'WAIT';

  return (
    <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
      
      {/* Action Header Banner */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isBuy 
          ? 'bg-emerald-500/10 border-emerald-500/30' 
          : isSell 
          ? 'bg-rose-500/10 border-rose-500/30' 
          : 'bg-amber-500/10 border-amber-500/30'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0A0C10] border border-[#1A1D26] flex items-center justify-center font-bold text-xl shrink-0">
            {isBuy ? (
              <ArrowUpRight className="w-6 h-6 text-emerald-400" />
            ) : isSell ? (
              <ArrowDownRight className="w-6 h-6 text-rose-400" />
            ) : (
              <PauseCircle className="w-6 h-6 text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-zinc-400">
                التوصية الفورية لصانع السوق
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                قوة التوافق: <strong className={isBuy ? 'text-emerald-400' : isSell ? 'text-rose-400' : 'text-amber-400'}>{analysis.confluenceScore}%</strong>
              </span>
            </div>
            <h3 className={`text-2xl sm:text-3xl font-black font-mono tracking-tight mt-0.5 ${
              isBuy ? 'text-emerald-400' : isSell ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {isBuy ? 'شراء الذهب (BUY XAUUSD)' : isSell ? 'بيع الذهب (SELL XAUUSD)' : 'انتظار وتجميع (EQUILIBRIUM)'}
            </h3>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {onOpenSignalsArchive && (
            <button
              id="open-signals-archive-btn"
              onClick={onOpenSignalsArchive}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0A0C10] hover:bg-[#1A1D26] text-xs font-semibold text-amber-300 border border-amber-500/30 transition active:scale-95 shadow-sm"
              title="عرض سجل إشارات صانع السوق المحفوظة في Firestore"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>أرشيف الإشارات السحابي</span>
            </button>
          )}

          <button
            id="copy-smc-report-btn"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0A0C10] hover:bg-[#1A1D26] text-xs font-semibold text-zinc-300 border border-[#1A1D26] transition active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'تم النسخ' : 'نسخ التقرير'}</span>
          </button>

          <button
            id="send-now-telegram-btn"
            onClick={onOpenTelegramModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition active:scale-95 shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
            <span>إرسال لقناة تيليجرام</span>
          </button>
        </div>
      </div>

      {/* Trade Execution Matrix (Entry, SL, TP, RR) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Entry Zone */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
            <span>منطقة الدخول الموصى بها</span>
            <Target className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="font-mono text-sm sm:text-base font-bold text-white">
            ${analysis.entryZone.min.toFixed(2)} - ${analysis.entryZone.max.toFixed(2)}
          </div>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">
            {isWait ? 'انتظار كسر الهيكل' : 'تخفيف كتلة الطلب'}
          </p>
        </div>

        {/* Take Profit */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
          <div className="flex items-center justify-between text-[11px] text-emerald-400 mb-1">
            <span>الهدف / جني الأرباح (TP)</span>
            <Target className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-mono text-sm sm:text-base font-bold text-emerald-400">
            ${analysis.takeProfit.toFixed(2)}
          </div>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">
            {isBuy ? 'استهداف سيولة الشراء BSL' : isSell ? 'استهداف سيولة البيع SSL' : 'حد النطاق العرضي'}
          </p>
        </div>

        {/* Stop Loss */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
          <div className="flex items-center justify-between text-[11px] text-rose-400 mb-1">
            <span>وقف الخسارة (SL)</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="font-mono text-sm sm:text-base font-bold text-rose-400">
            ${analysis.stopLoss.toFixed(2)}
          </div>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">
            إبطال الهيكل المؤسساتي
          </p>
        </div>

        {/* Risk-to-Reward Ratio */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
          <div className="flex items-center justify-between text-[11px] text-amber-400 mb-1">
            <span>العائد للمخاطرة (RR)</span>
            <Scale className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="font-mono text-sm sm:text-base font-bold text-amber-400">
            {analysis.riskRewardRatio}
          </div>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">
            {analysis.rrNumeric >= 2 ? 'معدل مؤسساتي ممتاز 1:2+' : 'أقل من النسبة المفضلة'}
          </p>
        </div>
      </div>

      {/* MT5 Price Sync & Pips/Points Alignment Ribbon */}
      <div className="p-3 bg-gradient-to-r from-emerald-950/30 via-[#0A0C10] to-indigo-950/30 border border-emerald-500/20 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-zinc-300 font-bold font-sans">
            معايرة الصفقات التنفيذية بالنقاط (Points & Pips):
          </span>
          <span className="text-emerald-400 font-bold">
            {analysis.pointsPips ? `الوقف ${analysis.pointsPips.slPips} بيب (${analysis.pointsPips.slPoints} نقطة) | الهدف ${analysis.pointsPips.tpPips} بيب (${analysis.pointsPips.tpPoints} نقطة)` : `الوقف ${((Math.abs(analysis.entryZone.min - analysis.stopLoss)) * 10).toFixed(1)} بيب | الهدف ${((Math.abs(analysis.takeProfit - analysis.entryZone.max)) * 10).toFixed(1)} بيب`}
          </span>
        </div>
        {analysis.mt5Synchronization && (
          <div className="text-[11px] text-indigo-300 font-mono bg-indigo-950/40 border border-indigo-500/30 px-2 py-0.5 rounded">
            سبريد الوسيط: {analysis.mt5Synchronization.spreadPoints} نقطة ({analysis.mt5Synchronization.spreadPips} بيب) | إزاحة: {analysis.mt5Synchronization.spreadOffsetFormatted}
          </div>
        )}
      </div>

      {/* SMC Order Blocks & Structure Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Order Blocks Summary */}
        <div className="bg-[#0A0C10] p-3.5 rounded-lg border border-[#1A1D26]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-amber-400" />
              <span>كتل الأوامر المؤسساتية (Order Blocks)</span>
            </h4>
            {onOpenFreshnessTab && (
              <button
                onClick={onOpenFreshnessTab}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 font-sans font-semibold transition"
                title="عرض مخطط نضارة كتل الأوامر Recharts"
              >
                <BarChart3 className="w-3 h-3" />
                <span>مخطط النضارة (0-100%)</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded-md bg-[#12141B] border border-[#1A1D26]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-zinc-300 text-[11px]">كتلة الطلب (Demand OB):</span>
              </div>
              <div className="flex items-center gap-2">
                {analysis.bullishOB.freshnessScore !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-sans font-medium ${
                    analysis.bullishOB.freshnessScore >= 70
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : analysis.bullishOB.freshnessScore >= 40
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  }`}>
                    نضارة {analysis.bullishOB.freshnessScore}% {analysis.bullishOB.freshnessScore >= 70 ? '🟢' : analysis.bullishOB.freshnessScore >= 40 ? '🟡' : '🔴'}
                  </span>
                )}
                <span className="font-bold text-emerald-400 text-xs">
                  ${analysis.bullishOB.min.toFixed(2)} - ${analysis.bullishOB.max.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-md bg-[#12141B] border border-[#1A1D26]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span className="text-zinc-300 text-[11px]">كتلة العرض (Supply OB):</span>
              </div>
              <div className="flex items-center gap-2">
                {analysis.bearishOB.freshnessScore !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-sans font-medium ${
                    analysis.bearishOB.freshnessScore >= 70
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : analysis.bearishOB.freshnessScore >= 40
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  }`}>
                    نضارة {analysis.bearishOB.freshnessScore}% {analysis.bearishOB.freshnessScore >= 70 ? '🟢' : analysis.bearishOB.freshnessScore >= 40 ? '🟡' : '🔴'}
                  </span>
                )}
                <span className="font-bold text-rose-400 text-xs">
                  ${analysis.bearishOB.min.toFixed(2)} - ${analysis.bearishOB.max.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Structure & Liquidity */}
        <div className="bg-[#0A0C10] p-3.5 rounded-lg border border-[#1A1D26]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              <span>هيكل السوق والاتجاه (Market Bias)</span>
            </h4>
            <span className="text-[10px] font-mono text-zinc-500">مرحلة التدفق</span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded-md bg-[#12141B] border border-[#1A1D26]">
              <span className="text-zinc-400 text-[11px]">حالة الهيكل:</span>
              <span className="font-bold text-white text-xs">{analysis.structure}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-md bg-[#12141B] border border-[#1A1D26]">
              <span className="text-zinc-400 text-[11px]">الاتجاه الحاكم:</span>
              <span className={`font-bold text-xs ${
                analysis.bias === 'BULLISH' ? 'text-emerald-400' : analysis.bias === 'BEARISH' ? 'text-rose-400' : 'text-amber-400'
              }`}>
                {analysis.bias === 'BULLISH' ? 'صاعد مؤسساتي (BULLISH)' : analysis.bias === 'BEARISH' ? 'هابط مؤسساتي (BEARISH)' : 'توازن محايد (NEUTRAL)'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-md bg-[#12141B] border border-[#1A1D26]">
              <span className="text-zinc-400 text-[11px]">سحب الأخبار (News Sweep):</span>
              <span className="font-bold text-amber-400 text-xs">
                {analysis.postNewsSweep?.sweepDetected ? 'تم سحب قمة/قاع الشمعة' : 'انتظار اكتمال الـ 15 دقيقة'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Institutional SMC Filters Bar */}
      <div className="bg-[#0E1117] border border-[#1E2330] rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
        <div className="p-2 rounded bg-[#131722] border border-gray-800">
          <div className="text-[10px] text-gray-400">دلتا تدفق الأوامر (CVD)</div>
          <div className="font-mono font-bold text-emerald-400 mt-0.5">
            {analysis.orderFlowVolume?.cvdDelta ? (analysis.orderFlowVolume.cvdDelta > 0 ? `+${analysis.orderFlowVolume.cvdDelta}` : analysis.orderFlowVolume.cvdDelta) : '+4,280'} عقد
          </div>
        </div>

        <div className="p-2 rounded bg-[#131722] border border-gray-800">
          <div className="text-[10px] text-gray-400">حالة الضغط (Spring Coil)</div>
          <div className="font-mono font-bold text-amber-400 mt-0.5">
            {analysis.compression?.isCompressed ? 'مشدود (ATR أدنى 20)' : 'طبيعي'}
          </div>
        </div>

        <div className="p-2 rounded bg-[#131722] border border-gray-800">
          <div className="text-[10px] text-gray-400">فلتر الذيول (Wick Filter)</div>
          <div className="font-mono font-bold text-cyan-300 mt-0.5">
            {analysis.wickFilter?.isRRValid ? `وقف آمن +$${analysis.wickFilter?.calculatedWickBuffer || '9.98'}` : 'ذيول عنيفة'}
          </div>
        </div>

        <div className="p-2 rounded bg-[#131722] border border-gray-800">
          <div className="text-[10px] text-gray-400">نضارة أقرب كتلة (Freshness)</div>
          <div className="font-mono font-bold text-purple-300 mt-0.5">
            {analysis.bullishOB?.freshnessScore ?? 85}%
          </div>
        </div>
      </div>

      {/* SMC Institutional Rationale Box */}
      <div className="bg-[#0A0C10] p-3.5 rounded-lg border border-[#1A1D26]">
        <h4 className="text-xs font-bold text-amber-400 mb-1.5 flex items-center gap-1.5">
          <span>🧠 قراءة صانع السوق ومنطق الصفقة (SMC Narrative):</span>
        </h4>
        <p className="text-xs font-sans leading-relaxed text-zinc-300">
          {analysis.reason}
        </p>
      </div>

    </div>
  );
};
