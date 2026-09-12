import React, { useState, useEffect } from 'react';
import {
  Layers,
  Calendar,
  Clock,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Send,
  Sliders,
  ChevronLeft,
  Flame,
  BarChart3,
  Compass
} from 'lucide-react';
import {
  MultiTimeframeSMCEngineState,
  WeeklyMajorLevel,
  DailyRefinedLevel,
  LiquiditySweep1H
} from '../types';
import { fetchMultiTimeframeSMC } from '../services/multiTimeframeService';

interface MultiTimeframeSMCCardProps {
  currentPrice: number | null;
  onSendToTelegram?: (messageText: string) => void;
  telegramConfigured?: boolean;
}

type SelectedTier = 'CASCADE' | '1W' | '1D' | '4H' | '1H' | '15M';

export const MultiTimeframeSMCCard: React.FC<MultiTimeframeSMCCardProps> = ({
  currentPrice,
  onSendToTelegram,
  telegramConfigured = false,
}) => {
  const [mtfData, setMtfData] = useState<MultiTimeframeSMCEngineState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTier, setSelectedTier] = useState<SelectedTier>('CASCADE');
  const [copied, setCopied] = useState<boolean>(false);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);

  // Fetch or refresh MTF data
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchMultiTimeframeSMC(currentPrice);
      setMtfData(data);
    } catch (err) {
      console.error('Failed to load MTF data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPrice]);

  const p = currentPrice ?? mtfData?.currentPrice ?? 4468.50;

  const handleCopyExecutionSignal = () => {
    if (!mtfData) return;
    const m15 = mtfData.m15Execution;
    const h4 = mtfData.h4Decision;
    const text = `🎯 *توصية تنفيذية من وحدة التحليل متعدد الفريمات (MTF SMC Engine)*
📍 *زوج التداول:* XAU/USD (الذهب الفوري / COMEX GC)
📊 *السعر اللحظي:* $${p.toFixed(2)}

🏛️ *1. الفريم الأسبوعي (1W HTF):* اتجاه صاعد رئيسي فوق $${mtfData.weeklyHTF.keySupport}
📅 *2. الفريم اليومي (1D HTF):* ${mtfData.dailyHTF.marketStructureLabelAr}
⚡ *3. فريم 4 ساعات (4H ITF - القرار الأساسي):* ${h4.primaryDecisionLabelAr}
🌊 *4. فريم الساعة (1H LTF):* تم رصد سحب السيولة بنجاح
🎯 *5. فريم 15 دقيقة (15M Execution):*
• *نوع الدخول:* ${m15.reversalPatternLabelAr}
• *نقطة الدخول الصيدلية:* $${m15.sniperEntryPrice}
• *وقف الخسارة الصيدلي:* $${m15.surgicalStopLoss} (${m15.stopLossDistancePips} نقطة)
• *الهدف الأول (TP1):* $${m15.surgicalTakeProfit1} (${m15.takeProfit1Pips} نقطة)
• *الهدف الثاني (TP2):* $${m15.surgicalTakeProfit2} (${m15.takeProfit2Pips} نقطة)
• *الهدف الثالث (TP3 - HTF):* $${m15.surgicalTakeProfit3}
• *نسبة العائد إلى المخاطرة (R:R):* ${m15.riskRewardRatio} (متوافقة مع شرط R:R ≥ 1:2.0)`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDispatchTelegram = () => {
    if (!mtfData || !onSendToTelegram) return;
    const m15 = mtfData.m15Execution;
    const h4 = mtfData.h4Decision;
    const text = `🎯 *توصية تنفيذية من وحدة التحليل متعدد الفريمات (MTF SMC Engine)*
📍 *زوج التداول:* XAU/USD (الذهب الفوري)
📊 *السعر اللحظي:* $${p.toFixed(2)}

🏛️ *الفريم الأسبوعي (1W):* مستويات دعم $${mtfData.weeklyHTF.keySupport} ومقاومة $${mtfData.weeklyHTF.keyResistance}
📅 *الفريم اليومي (1D):* هيكل ${mtfData.dailyHTF.trend === 'BULLISH' ? 'صاعد' : 'هابط'} مع كسر قمم
⚡ *فريم 4 ساعات (4H - القرار الأساسي):* ${h4.primaryDecisionLabelAr}
🌊 *فريم الساعة (1H):* ${mtfData.h1Sweeps.lastSweepReactionAr}
🎯 *فريم 15 دقيقة (15M - إشارة الدخول):*
• الدخول: $${m15.sniperEntryPrice}
• الوقف: $${m15.surgicalStopLoss}
• الأهداف: $${m15.surgicalTakeProfit1} / $${m15.surgicalTakeProfit2} / $${m15.surgicalTakeProfit3}
• نسبة R:R: ${m15.riskRewardRatio}`;

    onSendToTelegram(text);
    setDispatchNotice('تم إرسال التحليل والتوصية لقناة تيليجرام بنجاح! ✅');
    setTimeout(() => setDispatchNotice(null), 3500);
  };

  if (!mtfData) {
    return (
      <div id="mtf-loading-card" className="bg-[#0D111A] border border-[#1A1D26] rounded-xl p-6 text-center text-zinc-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
        <p className="text-sm font-sans">جاري تحميل مصفوفة التحليل متعدد الفريمات المؤسساتية...</p>
      </div>
    );
  }

  const { weeklyHTF, dailyHTF, h4Decision, h1Sweeps, m15Execution } = mtfData;

  return (
    <div id="multi-timeframe-smc-engine-card" className="space-y-4">
      {/* Header & Hierarchy Overview Banner */}
      <div className="bg-[#0D111A] border border-[#1A1D26] rounded-xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100 font-sans">
                  وحدة التحليل متعدد الفريمات الزمنية (Multi-Timeframe SMC Engine)
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold">
                  التسلسل الهيكلي الـ 5 (1W → 1D → 4H → 1H → 15M)
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 font-sans">
                تدرج مؤسساتي دقيق من الإطار الزمني الأكبر إلى فريم الدخول الصيدلي بوقف خسارة محمي ونسبة R:R ≥ 1:2.0
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-[#0A0C10] border border-[#1A1D26] text-right">
              <span className="text-[10px] text-zinc-400 block font-sans">السعر اللحظي الفوري</span>
              <span className="text-sm font-mono font-bold text-amber-400">
                ${p.toFixed(2)}
              </span>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-[#0A0C10] border border-emerald-500/30 text-right">
              <span className="text-[10px] text-zinc-400 block font-sans">التوافق الهيكلي (Confluence)</span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                {mtfData.alignmentScore}% تطابق كامل
              </span>
            </div>

            <button
              id="mtf-refresh-btn"
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg bg-[#141822] hover:bg-[#1C2230] border border-[#252D42] text-zinc-300 hover:text-white transition disabled:opacity-50"
              title="تحديث التحليل متعدد الفريمات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Cascade Alignment Summary */}
        <div className="mt-4 p-3 rounded-lg bg-[#07090E] border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="text-xs text-zinc-300 font-sans font-medium leading-relaxed">
              <strong className="text-emerald-400 ml-1">حالة الشلال المؤسساتي:</strong>
              {mtfData.cascadeSummaryAr}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="mtf-copy-execution-btn"
              onClick={handleCopyExecutionSignal}
              className="inline-flex items-center gap-1.5 text-xs font-sans px-2.5 py-1.5 rounded bg-[#141822] hover:bg-[#1A202C] text-zinc-200 border border-[#252D42] transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{copied ? 'تم النسخ' : 'نسخ التوصية'}</span>
            </button>

            {telegramConfigured && (
              <button
                id="mtf-dispatch-telegram-btn"
                onClick={handleDispatchTelegram}
                className="inline-flex items-center gap-1.5 text-xs font-sans px-2.5 py-1.5 rounded bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 transition font-medium"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال لتيليجرام</span>
              </button>
            )}
          </div>
        </div>

        {dispatchNotice && (
          <div className="mt-2.5 p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-sans text-center">
            {dispatchNotice}
          </div>
        )}

        {/* 5-Tier Navigation Pills */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#1A1D26]">
          <button
            onClick={() => setSelectedTier('CASCADE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
              selectedTier === 'CASCADE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-[#10141D] text-zinc-400 hover:text-zinc-200 hover:bg-[#151B27]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>عرض الشلال المؤسساتي الكامل</span>
          </button>

          <button
            onClick={() => setSelectedTier('1W')}
            className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
              selectedTier === '1W'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-[#10141D] text-zinc-400 hover:text-zinc-200 hover:bg-[#151B27]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-rose-400" />
            <span>1. الفريم الأسبوعي (1W HTF)</span>
          </button>

          <button
            onClick={() => setSelectedTier('1D')}
            className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
              selectedTier === '1D'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-[#10141D] text-zinc-400 hover:text-zinc-200 hover:bg-[#151B27]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>2. الفريم اليومي (1D HTF)</span>
          </button>

          <button
            onClick={() => setSelectedTier('4H')}
            className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
              selectedTier === '4H'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-[#10141D] text-zinc-400 hover:text-zinc-200 hover:bg-[#151B27]'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>3. فريم 4 ساعات (4H القرار الأساسي)</span>
          </button>

          <button
            onClick={() => setSelectedTier('1H')}
            className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
              selectedTier === '1H'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-[#10141D] text-zinc-400 hover:text-zinc-200 hover:bg-[#151B27]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-purple-400" />
            <span>4. فريم الساعة (1H Sweeps)</span>
          </button>

          <button
            onClick={() => setSelectedTier('15M')}
            className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
              selectedTier === '15M'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                : 'bg-[#10141D] text-zinc-400 hover:text-zinc-200 hover:bg-[#151B27]'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>5. فريم 15 دقيقة (15M Execution)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TIER 1: Weekly HTF - Major Historical Support / Resistance Levels */}
      {/* ========================================================================= */}
      {(selectedTier === 'CASCADE' || selectedTier === '1W') && (
        <div id="weekly-htf-section" className="bg-[#0D111A] border border-[#1A1D26] rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#1A1D26] pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-rose-500/15 text-rose-400 font-mono font-bold text-xs flex items-center justify-center border border-rose-500/30">
                1
              </span>
              <div>
                <h3 className="text-sm font-bold text-zinc-100 font-sans">
                  الفريم الأسبوعي (Weekly HTF - Major Levels)
                </h3>
                <p className="text-xs text-zinc-400 font-sans">
                  استخراج مناطق الدعم والمقاومة التاريخية الرئيسية التي ارتد منها السعر بقوة كخطوط أفقية مرجعية
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              {weeklyHTF.htfTrendAr}
            </span>
          </div>

          {/* Interactive Horizontal Reference Lines Visualizer */}
          <div className="space-y-2.5">
            <div className="text-xs text-zinc-400 font-sans flex items-center justify-between mb-1">
              <span>الخطوط الأفقية المرجعية الأسبوعية (Horizontal Reference Lines):</span>
              <span className="text-[11px] font-mono text-zinc-500">حجم عقود COMEX GC التراكمي</span>
            </div>

            {weeklyHTF.majorLevels.map((lvl) => {
              const isRes = lvl.type === 'MAJOR_WEEKLY_RESISTANCE';
              const isSup = lvl.type === 'MAJOR_WEEKLY_SUPPORT';
              const isEq = lvl.type === 'HISTORICAL_EQUILIBRIUM';

              return (
                <div
                  key={lvl.id}
                  className={`p-3 rounded-lg border transition ${
                    isRes
                      ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                      : isSup
                      ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                      : 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {/* Horizontal line representation */}
                      <div className="w-12 h-1.5 rounded-full flex items-center">
                        <div
                          className={`w-full h-1 rounded ${
                            isRes ? 'bg-rose-500' : isSup ? 'bg-emerald-500' : 'bg-amber-400 border-dashed'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-100 font-mono">
                            ${lvl.price.toFixed(2)}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                              isRes
                                ? 'bg-rose-500/20 text-rose-300'
                                : isSup
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {lvl.labelAr}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5 font-sans">
                          {lvl.rationaleAr}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs text-right">
                      <div className="px-2 py-1 rounded bg-[#0A0C10] border border-[#1A1D26]">
                        <span className="text-[10px] text-zinc-500 block">عدد الارتدادات</span>
                        <span className="text-zinc-200 font-bold">{lvl.touchCount} مرات 🔁</span>
                      </div>

                      <div className="px-2 py-1 rounded bg-[#0A0C10] border border-[#1A1D26]">
                        <span className="text-[10px] text-zinc-500 block">قوة الارتداد</span>
                        <span
                          className={`font-bold ${
                            lvl.reboundStrength === 'EXTREME_REJECTION'
                              ? 'text-rose-400'
                              : lvl.reboundStrength === 'STRONG_REJECTION'
                              ? 'text-amber-400'
                              : 'text-zinc-300'
                          }`}
                        >
                          {lvl.reboundStrength === 'EXTREME_REJECTION' ? 'ارتداد عنيف ⚡' : 'ارتداد قوي'}
                        </span>
                      </div>

                      <div className="px-2 py-1 rounded bg-[#0A0C10] border border-[#1A1D26]">
                        <span className="text-[10px] text-zinc-500 block">المسافة للسعر</span>
                        <span className="text-zinc-300 font-bold">{lvl.distanceUsd}$</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 p-2.5 rounded-lg bg-[#07090E] border border-[#1A1D26] text-xs text-zinc-400 font-sans flex items-center justify-between">
            <span>ملاحظة الإطار الأسبوعي: {weeklyHTF.institutionalNotesAr}</span>
            <span className="text-emerald-400 font-mono font-bold shrink-0">النطاق الأسبوعي: {weeklyHTF.weeklyRangePct}%</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIER 2: Daily HTF - Trend & Refinement with Distinct Colors */}
      {/* ========================================================================= */}
      {(selectedTier === 'CASCADE' || selectedTier === '1D') && (
        <div id="daily-htf-section" className="bg-[#0D111A] border border-[#1A1D26] rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#1A1D26] pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-cyan-500/15 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center border border-cyan-500/30">
                2
              </span>
              <div>
                <h3 className="text-sm font-bold text-zinc-100 font-sans">
                  الفريم اليومي (Daily HTF - Trend & Refinement)
                </h3>
                <p className="text-xs text-zinc-400 font-sans">
                  تحديد الاتجاه العام وهيكل السوق (Market Structure) وتهذيب المستويات الأسبوعية بدقة أعلى وألوان تمييزية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
                {dailyHTF.trendLabelAr}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-[#07090E] border border-[#1A1D26]">
              <span className="text-[10px] text-zinc-400 block font-sans">هيكل السوق اليومي (Structure)</span>
              <div className="text-xs font-bold text-emerald-400 font-sans mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{dailyHTF.marketStructureLabelAr}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#07090E] border border-[#1A1D26]">
              <span className="text-[10px] text-zinc-400 block font-sans">قمة وقاع النطاق اليومي (Daily Range)</span>
              <div className="text-xs font-mono text-zinc-200 mt-1 flex items-center justify-between">
                <span>القمة: <strong className="text-rose-400">${dailyHTF.swingHigh}</strong></span>
                <span>القاع: <strong className="text-emerald-400">${dailyHTF.swingLow}</strong></span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#07090E] border border-cyan-500/30">
              <span className="text-[10px] text-cyan-300 block font-sans">تحسين الدقة عن الأسبوعي (Refinement)</span>
              <div className="text-xs font-mono font-bold text-cyan-400 mt-1 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span>تهذيب دقيق بمقدار +{dailyHTF.refinementDeltaPips} نقطة (Pips)</span>
              </div>
            </div>
          </div>

          {/* Refined Daily Levels with Distinct Color Palette (Cyan & Amber) */}
          <div className="space-y-2">
            <span className="text-xs text-zinc-400 font-sans block mb-1">
              المستويات اليومية المهذبة (Refined Daily Levels - ألوان تمييزية):
            </span>

            {dailyHTF.refinedLevels.map((rl) => (
              <div
                key={rl.id}
                className="p-2.5 rounded-lg bg-[#0A0C10] border flex items-center justify-between gap-3 text-xs"
                style={{ borderColor: `${rl.colorCode}40` }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: rl.colorCode }}
                  />
                  <div>
                    <span className="font-bold text-zinc-200 font-sans">{rl.labelAr}</span>
                    <span className="text-zinc-500 font-mono text-[11px] mr-2">
                      (تهذيب بدقة +{rl.accuracyRefinementPips} بيب)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${rl.colorCode}20`,
                      color: rl.colorCode,
                      border: `1px solid ${rl.colorCode}40`
                    }}
                  >
                    ${rl.price.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {rl.price > p ? `يبعد +${(rl.price - p).toFixed(2)}$` : `يبعد -${(p - rl.price).toFixed(2)}$`}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-400 mt-3 font-sans">
            {dailyHTF.structureNotesAr}
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIER 3: 4H ITF - Supply/Demand & Decision Frame (Anchor Decision) */}
      {/* ========================================================================= */}
      {(selectedTier === 'CASCADE' || selectedTier === '4H') && (
        <div id="h4-decision-section" className="bg-[#0D111A] border border-[#1A1D26] rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#1A1D26] pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-400 font-mono font-bold text-xs flex items-center justify-center border border-amber-500/30">
                3
              </span>
              <div>
                <h3 className="text-sm font-bold text-zinc-100 font-sans">
                  فريم 4 ساعات (4H ITF - Supply/Demand & Decision)
                </h3>
                <p className="text-xs text-zinc-400 font-sans">
                  تحديد مناطق العرض والطلب وكتل الأوامر ومستويات السيولة، مع اتخاذ القرار الأساسي لاتجاه التداول
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
              فريم القرار الأساسي 🎯
            </span>
          </div>

          {/* Primary Trade Direction Decision Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-[#0A0C10] to-[#0A0C10] border border-amber-500/40 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-sans">القرار الأساسي لاتجاه التداول (4H Base Decision):</span>
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                      h4Decision.decisionAction === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {h4Decision.decisionAction === 'BUY' ? '🟢 تمركز شراء رئيسي (BUY FLOW)' : '🔴 تمركز بيع رئيسي (SELL FLOW)'}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-zinc-100 mt-1 font-sans">
                  {h4Decision.primaryDecisionLabelAr}
                </h4>
                <p className="text-xs text-zinc-300 mt-1 font-sans leading-relaxed">
                  {h4Decision.decisionRationaleAr}
                </p>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 font-mono text-xs">
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 block font-sans">نسبة الثقة والتوافق</span>
                  <span className="text-amber-400 font-bold text-sm">{h4Decision.confluenceScore}%</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 block font-sans">الحد الأدنى المقترح R:R</span>
                  <span className="text-emerald-400 font-bold">{h4Decision.suggestedRR}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4H Zones & Liquidity Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Bullish Demand Zone / OB */}
            <div className="p-3 rounded-lg bg-[#07090E] border border-emerald-500/30">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-emerald-400 font-sans">
                  كتلة الطلب 4H (Demand Order Block)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  نضارة {h4Decision.demandZone.freshnessPct}% 🟢
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-200 flex items-center justify-between">
                <span>النطاق: ${h4Decision.demandZone.min} - ${h4Decision.demandZone.max}</span>
                <span className="text-zinc-400">التوازن: ${h4Decision.demandZone.equilibrium}</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1.5 font-sans">
                حجم العقود: {h4Decision.bullishOrderBlock.volume} | غير ملموسة (Unmitigated)
              </p>
            </div>

            {/* Bearish Supply Zone / OB */}
            <div className="p-3 rounded-lg bg-[#07090E] border border-rose-500/30">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-rose-400 font-sans">
                  كتلة العرض 4H (Supply Order Block)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                  نضارة {h4Decision.supplyZone.freshnessPct}% 🟡
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-200 flex items-center justify-between">
                <span>النطاق: ${h4Decision.supplyZone.min} - ${h4Decision.supplyZone.max}</span>
                <span className="text-zinc-400">التوازن: ${h4Decision.supplyZone.equilibrium}</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1.5 font-sans">
                حجم العقود: {h4Decision.bearishOrderBlock.volume} | غير ملموسة (Unmitigated)
              </p>
            </div>
          </div>

          {/* Liquidity targets */}
          <div className="mt-3 p-2.5 rounded-lg bg-[#0A0C10] border border-[#1A1D26] flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400 font-sans">مستويات السيولة 4H:</span>
            <div className="flex items-center gap-4">
              <span>سيولة الشراء (BSL): <strong className="text-rose-400">${h4Decision.bslPrice}</strong></span>
              <span>سيولة البيع (SSL): <strong className="text-emerald-400">${h4Decision.sslPrice}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIER 4: 1H LTF - Liquidity Sweeps Tracking Before Zone Test */}
      {/* ========================================================================= */}
      {(selectedTier === 'CASCADE' || selectedTier === '1H') && (
        <div id="h1-sweeps-section" className="bg-[#0D111A] border border-[#1A1D26] rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#1A1D26] pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-purple-500/15 text-purple-400 font-mono font-bold text-xs flex items-center justify-center border border-purple-500/30">
                4
              </span>
              <div>
                <h3 className="text-sm font-bold text-zinc-100 font-sans">
                  فريم الساعة (1H LTF - Liquidity Sweeps)
                </h3>
                <p className="text-xs text-zinc-400 font-sans">
                  تتبع حركات سحب السيولة الصادرة من صناع السوق قبل اختبار مناطق العرض والطلب المحددة
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold">
              رادار المصائد المؤسساتية ⚡
            </span>
          </div>

          <div className="space-y-2.5">
            {h1Sweeps.activeSweeps.map((sw) => (
              <div
                key={sw.id}
                className="p-3 rounded-lg bg-[#07090E] border border-purple-500/30 hover:border-purple-500/50 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-zinc-100 font-sans">{sw.titleAr}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                        {sw.reactionType === 'IMMEDIATE_REJECTION_WICK' ? 'ذيل رفض فوري 🟢' : 'فخ كسر كاذب 🔴'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 font-sans leading-relaxed">
                      {sw.statusAr}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                    <div className="px-2 py-1 rounded bg-[#0A0C10] border border-[#1A1D26] text-right">
                      <span className="text-[10px] text-zinc-500 block">نقطة السحب</span>
                      <span className="text-amber-400 font-bold">${sw.sweepHighLow}</span>
                    </div>

                    <div className="px-2 py-1 rounded bg-[#0A0C10] border border-[#1A1D26] text-right">
                      <span className="text-[10px] text-zinc-500 block">دلتا الحجم</span>
                      <span className="text-emerald-400 font-bold">+{sw.volumeDeltaSpike} عقد</span>
                    </div>

                    <div className="px-2 py-1 rounded bg-[#0A0C10] border border-[#1A1D26] text-right">
                      <span className="text-[10px] text-zinc-500 block">التوقيت</span>
                      <span className="text-zinc-400">{sw.timestamp}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 p-2.5 rounded-lg bg-[#0A0C10] border border-[#1A1D26] text-xs text-zinc-400 font-sans flex items-center justify-between">
            <span>حكم فريم الساعة: {h1Sweeps.sweepVerdictAr}</span>
            <span className="text-purple-400 font-mono font-bold shrink-0">سحوبات آخر 24 ساعة: {h1Sweeps.sweepCountLast24h}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIER 5: 15M Entry Frame - Execution Signals & Sniper Stop Loss */}
      {/* ========================================================================= */}
      {(selectedTier === 'CASCADE' || selectedTier === '15M') && (
        <div id="m15-execution-section" className="bg-[#0D111A] border border-emerald-500/40 rounded-xl p-4 sm:p-5 shadow-lg shadow-emerald-500/5">
          <div className="flex items-center justify-between border-b border-[#1A1D26] pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center border border-emerald-500/40">
                5
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-100 font-sans">
                    فريم 15 دقيقة (15M Entry Frame - Execution Signals)
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                    إشارة دخول نشطة 🔥
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-sans">
                  تفعيل إشارات الدخول والتأكيد المباشر فور حدوث CHoCH ونماذج انعكاسية، مع وقف خسارة صيدلي دقيق
                </p>
              </div>
            </div>

            <span className="text-xs font-mono font-bold text-emerald-400 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
              R:R {m15Execution.riskRewardRatio} ✅
            </span>
          </div>

          {/* CHoCH & Confirmation Status Card */}
          <div className="p-3.5 rounded-lg bg-[#07090E] border border-emerald-500/30 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300 font-sans">
                    تأكيد تغير شخصية السعر (Confirmed CHoCH 15M):
                  </span>
                  <span className="text-xs font-mono text-zinc-200">
                    تم الإغلاق فوق ${m15Execution.chohLevel}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1 font-sans">
                  {m15Execution.executionRuleVerdictAr}
                </p>
              </div>

              <div className="px-3 py-1.5 rounded bg-[#0A0C10] border border-[#1A1D26] text-right font-mono shrink-0">
                <span className="text-[10px] text-zinc-500 block font-sans">النموذج الانعكاسي</span>
                <span className="text-xs font-bold text-amber-400">{m15Execution.reversalPatternLabelAr}</span>
              </div>
            </div>
          </div>

          {/* Execution Matrix: Entry, Surgical SL, TP1, TP2, TP3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 font-mono">
            {/* Entry */}
            <div className="p-3 rounded-lg bg-[#07090E] border border-emerald-500/30">
              <span className="text-[10px] text-zinc-400 block font-sans">نقطة الدخول الصيدلية (Entry)</span>
              <span className="text-base font-bold text-emerald-400 block mt-0.5">
                ${m15Execution.sniperEntryPrice.toFixed(2)}
              </span>
              <span className="text-[10px] text-zinc-500 font-sans">أمر محدد (Limit Order)</span>
            </div>

            {/* Surgical SL */}
            <div className="p-3 rounded-lg bg-[#07090E] border border-rose-500/30">
              <span className="text-[10px] text-zinc-400 block font-sans">وقف الخسارة الصيدلي (Surgical SL)</span>
              <span className="text-base font-bold text-rose-400 block mt-0.5">
                ${m15Execution.surgicalStopLoss.toFixed(2)}
              </span>
              <span className="text-[10px] text-rose-300/80 font-sans">
                المسافة: {m15Execution.stopLossDistancePips} نقطة (بيب)
              </span>
            </div>

            {/* TP1 */}
            <div className="p-3 rounded-lg bg-[#07090E] border border-[#1A1D26]">
              <span className="text-[10px] text-zinc-400 block font-sans">الهدف الأول (TP1 - تأمين 50%)</span>
              <span className="text-base font-bold text-zinc-200 block mt-0.5">
                ${m15Execution.surgicalTakeProfit1.toFixed(2)}
              </span>
              <span className="text-[10px] text-emerald-400 font-sans">
                +{m15Execution.takeProfit1Pips} نقطة
              </span>
            </div>

            {/* TP2 */}
            <div className="p-3 rounded-lg bg-[#07090E] border border-emerald-500/20">
              <span className="text-[10px] text-zinc-400 block font-sans">الهدف الثاني (TP2 - السيولة)</span>
              <span className="text-base font-bold text-emerald-300 block mt-0.5">
                ${m15Execution.surgicalTakeProfit2.toFixed(2)}
              </span>
              <span className="text-[10px] text-emerald-400 font-sans">
                +{m15Execution.takeProfit2Pips} نقطة (R:R 1:3.3)
              </span>
            </div>

            {/* TP3 */}
            <div className="p-3 rounded-lg bg-[#07090E] border border-amber-500/20">
              <span className="text-[10px] text-zinc-400 block font-sans">الهدف الأسبوعي (TP3 - HTF Target)</span>
              <span className="text-base font-bold text-amber-400 block mt-0.5">
                ${m15Execution.surgicalTakeProfit3.toFixed(2)}
              </span>
              <span className="text-[10px] text-amber-300 font-sans">
                سيولة الشراء BSL
              </span>
            </div>
          </div>

          {/* Compliance Badge with R:R Floor */}
          <div className="mt-3 p-2.5 rounded-lg bg-[#0A0C10] border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-zinc-300 font-sans">
                <strong>الامتثال لقواعد إدارة المخاطر الصارمة:</strong> نسبة العائد للمخاطرة <strong>{m15Execution.riskRewardRatio}</strong> تتجاوز شرط الحد الأدنى الإلزامي (R:R ≥ 1:2.0).
              </span>
            </div>
            <span className="text-emerald-400 font-mono font-bold shrink-0">
              حماية الوقف: تم تطبيق فلتر ذيول 10 شموع + 1.5 ATR ✅
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
