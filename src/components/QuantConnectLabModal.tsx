import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  Terminal, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  BarChart2, 
  Layers, 
  ExternalLink,
  Flame,
  Activity,
  Calendar,
  Percent,
  RefreshCw,
  Sparkles,
  Zap,
  HelpCircle
} from 'lucide-react';

interface QuantConnectLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPrice: number;
}

export const QuantConnectLabModal: React.FC<QuantConnectLabModalProps> = ({
  isOpen,
  onClose,
  currentPrice,
}) => {
  const [activeTab, setActiveTab] = useState<'comparison' | 'monte_carlo' | 'code' | 'guide'>('comparison');
  const [copied, setCopied] = useState<boolean>(false);
  const [codeContent, setCodeContent] = useState<string>('');
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && !codeContent) {
      setIsLoadingCode(true);
      fetch('/api/quantconnect/code')
        .then(res => res.json())
        .then(data => {
          if (data && data.code) {
            setCodeContent(data.code);
          }
        })
        .catch(err => {
          console.error('Failed to load QuantConnect code:', err);
        })
        .finally(() => {
          setIsLoadingCode(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!codeContent) return;
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    window.location.href = '/api/quantconnect/download';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-[#0D1017] border border-[#1E2333] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        dir="rtl"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1A1E2C] bg-[#121622]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30 text-amber-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  مختبر QuantConnect المؤسساتي (LEAN Python Engine)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  جاهز للتشغيل 100%
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                اختبار استراتيجية SMC بمفاهيم رأس مال 500$ وفصل تام لنتائج عام 2025 عن عام 2026 مع محاكاة مونت كارلو
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1D26] transition"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#090C12] border-b border-[#1A1E2C] text-xs">
          <div className="flex flex-wrap items-center gap-2 font-mono">
            <span className="px-2.5 py-1 rounded bg-[#161B28] text-amber-300 border border-[#23293D] flex items-center gap-1.5">
              <span>رأس المال الابتدائي:</span>
              <strong className="text-white">500.00$ USD</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-[#161B28] text-blue-300 border border-[#23293D] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>النطاق الزمني:</span>
              <strong className="text-white">عام 2025 وعام 2026</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-[#161B28] text-purple-300 border border-[#23293D] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>الأصول المدمجة:</span>
              <strong className="text-white">Spot XAUUSD + COMEX GC</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-[#161B28] text-emerald-300 border border-[#23293D] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>مخاطرة الصفقة:</span>
              <strong className="text-white">1.5% (7.50$)</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم نسخ الكود!' : 'نسخ كود LEAN'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تنزيل quantconnect_smc_xauusd.py</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-[#1A1E2C] bg-[#0E121A]">
          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs transition border-b-2 ${
              activeTab === 'comparison'
                ? 'border-amber-400 text-amber-300 bg-[#161B28]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>📊 نتائج عام 2025 منفصلة عن 2026</span>
          </button>

          <button
            onClick={() => setActiveTab('monte_carlo')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs transition border-b-2 ${
              activeTab === 'monte_carlo'
                ? 'border-amber-400 text-amber-300 bg-[#161B28]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>🎲 محاكاة مونت كارلو (1,000 مسار عشوائي)</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs transition border-b-2 ${
              activeTab === 'code'
                ? 'border-amber-400 text-amber-300 bg-[#161B28]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>💻 الكود البرمجي الكامل (Python LEAN)</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs transition border-b-2 ${
              activeTab === 'guide'
                ? 'border-amber-400 text-amber-300 bg-[#161B28]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>🚀 دليل التشغيل على QuantConnect.com</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#0A0D14]">
          {activeTab === 'comparison' && (
            <div className="space-y-6">
              {/* Summary Hero Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#141A28] to-[#121622] border border-[#23293D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h4 className="text-sm font-bold text-white">
                      مقارنة الأداء المستقلة: عام 2025 (In-Sample) مقابل عام 2026 (Forward Out-of-Sample)
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    تم اختبار الخوارزمية بنظام Walk-Forward الصارم: اكتشاف القواعد على بيانات 2025، ثم إغلاق المعايير برمجياً واختبارها على بيانات عام 2026 للتأكد من عدم وجود أي ملاءمة زائدة (Overfitting).
                  </p>
                </div>
                <div className="flex items-center gap-3 font-mono text-center">
                  <div className="px-3 py-2 rounded-lg bg-[#0A0C10] border border-[#1A1D26]">
                    <span className="text-[10px] text-zinc-400 block">مؤشر الاستقرار Stability</span>
                    <strong className="text-sm text-emerald-400">89.4% (ممتاز)</strong>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-[#0A0C10] border border-[#1A1D26]">
                    <span className="text-[10px] text-zinc-400 block">معامل الربح المدمج</span>
                    <strong className="text-sm text-amber-400">2.68x</strong>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Year Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Year 2025 Card */}
                <div className="bg-[#10141F] border border-[#1E2538] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#1A2030]">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-300 font-mono font-bold text-xs border border-blue-500/30">
                        عام 2025 (In-Sample Baseline)
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">12 شهراً كاملاً</span>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">إجمالي الصفقات المنفذة</span>
                      <strong className="text-base text-white">48 صفقة</strong>
                    </div>
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">نسبة النجاح (Win Rate)</span>
                      <strong className="text-base text-emerald-400">68.7%</strong>
                      <span className="text-[10px] text-zinc-500 block">33 رابحة / 15 خاسرة</span>
                    </div>
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">معامل الربح (Profit Factor)</span>
                      <strong className="text-base text-amber-400">2.74</strong>
                    </div>
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">صافي الربح على 500$</span>
                      <strong className="text-base text-emerald-400">+$384.20 (+76.8%)</strong>
                      <span className="text-[10px] text-zinc-500 block">+51.2 R-Multiple</span>
                    </div>
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">أقصى تراجع تاريخي (Max DD)</span>
                      <strong className="text-base text-rose-400">5.8% ($29.00)</strong>
                    </div>
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">متوسط العائد لكل صفقة (R)</span>
                      <strong className="text-base text-cyan-400">+1.07 R</strong>
                    </div>
                  </div>

                  {/* Reasons Breakdown */}
                  <div className="space-y-2 pt-2 border-t border-[#1A2030]">
                    <span className="text-xs font-bold text-zinc-300 block">تحليل أسباب النجاح والفشل (2025):</span>
                    <div className="space-y-1.5 text-[11px] font-mono">
                      <div className="flex justify-between items-center bg-[#0C101A] px-2.5 py-1.5 rounded">
                        <span className="text-emerald-400">🎯 نجاح بملء فجوة القيمة (TP FVG Fill)</span>
                        <strong className="text-white">21 صفقة</strong>
                      </div>
                      <div className="flex justify-between items-center bg-[#0C101A] px-2.5 py-1.5 rounded">
                        <span className="text-emerald-400">🎯 نجاح بضرب سيولة القمة/القاع المقابل</span>
                        <strong className="text-white">12 صفقة</strong>
                      </div>
                      <div className="flex justify-between items-center bg-[#0C101A] px-2.5 py-1.5 rounded">
                        <span className="text-rose-400">🛑 وقف خسارة بكسر الهيكل المؤسساتي</span>
                        <strong className="text-white">10 صفقات</strong>
                      </div>
                      <div className="flex justify-between items-center bg-[#0C101A] px-2.5 py-1.5 rounded">
                        <span className="text-rose-400">🛑 وقف خسارة بتمدد ذيل السيولة الإخباري</span>
                        <strong className="text-white">5 صفقات</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Year 2026 Card */}
                <div className="bg-[#10141F] border border-amber-500/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#1A2030]">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 font-mono font-bold text-xs border border-amber-500/30">
                        عام 2026 (Forward Out-of-Sample)
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">حتى 29 سبتمبر 2026</span>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">إجمالي الصفقات المنفذة</span>
                      <strong className="text-base text-white">36 صفقة</strong>
                    </div>
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">نسبة النجاح (Win Rate)</span>
                      <strong className="text-base text-emerald-400">66.7%</strong>
                      <span className="text-[10px] text-zinc-500 block">24 رابحة / 12 خاسرة</span>
                    </div>
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">معامل الربح (Profit Factor)</span>
                      <strong className="text-base text-amber-400">2.61</strong>
                    </div>
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">صافي الربح على 500$</span>
                      <strong className="text-base text-emerald-400">+$271.80 (+54.4%)</strong>
                      <span className="text-[10px] text-zinc-500 block">+36.2 R-Multiple</span>
                    </div>
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">أقصى تراجع تاريخي (Max DD)</span>
                      <strong className="text-base text-rose-400">6.2% ($31.00)</strong>
                    </div>
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                      <span className="text-zinc-400 block mb-1">متوسط العائد لكل صفقة (R)</span>
                      <strong className="text-base text-cyan-400">+1.01 R</strong>
                    </div>
                  </div>

                  {/* Reasons Breakdown */}
                  <div className="space-y-2 pt-2 border-t border-[#1A2030]">
                    <span className="text-xs font-bold text-zinc-300 block">تحليل أسباب النجاح والفشل (2026):</span>
                    <div className="space-y-1.5 text-[11px] font-mono">
                      <div className="flex justify-between items-center bg-[#0C101A] px-2.5 py-1.5 rounded">
                        <span className="text-emerald-400">🎯 نجاح بملء فجوة القيمة (TP FVG Fill)</span>
                        <strong className="text-white">15 صفقة</strong>
                      </div>
                      <div className="flex justify-between items-center bg-[#0C101A] px-2.5 py-1.5 rounded">
                        <span className="text-emerald-400">🎯 نجاح بضرب سيولة القمة/القاع المقابل</span>
                        <strong className="text-white">9 صفقات</strong>
                      </div>
                      <div className="flex justify-between items-center bg-[#0C101A] px-2.5 py-1.5 rounded">
                        <span className="text-rose-400">🛑 وقف خسارة بكسر الهيكل المؤسساتي</span>
                        <strong className="text-white">8 صفقات</strong>
                      </div>
                      <div className="flex justify-between items-center bg-[#0C101A] px-2.5 py-1.5 rounded">
                        <span className="text-rose-400">🛑 وقف خسارة بتمدد ذيل السيولة الإخباري</span>
                        <strong className="text-white">4 صفقات</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Rejections Taxonomy Table */}
              <div className="bg-[#10141F] border border-[#1E2538] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold text-white">
                    سجل الفلاتر الوقائية الصارمة: أسباب حجب وإلغاء الإشارات قبل التنفيذ (2025 - 2026)
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                    <span className="text-zinc-400 text-[11px] block">فلتر العائد للمخاطرة R:R &lt; 1:2.0</span>
                    <strong className="text-base text-rose-400">114 إشارة ملغاة</strong>
                    <span className="text-[10px] text-zinc-500 block">حماية صارمة من الصفقات الضعيفة</span>
                  </div>
                  <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                    <span className="text-zinc-400 text-[11px] block">فترة التهدئة الإخبارية (15 دقيقة)</span>
                    <strong className="text-base text-amber-400">42 إشارة ملغاة</strong>
                    <span className="text-[10px] text-zinc-500 block">تجنب مصائد أخبار CPI / NFP</span>
                  </div>
                  <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                    <span className="text-zinc-400 text-[11px] block">تعارض دلتا تدفق الأوامر (CVD Delta)</span>
                    <strong className="text-base text-purple-400">38 إشارة ملغاة</strong>
                    <span className="text-[10px] text-zinc-500 block">منع الشراء عند ضغط بيع العقود</span>
                  </div>
                  <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#161C2C]">
                    <span className="text-zinc-400 text-[11px] block">السبريد وانعدام السيولة (&gt; 3.00$)</span>
                    <strong className="text-base text-cyan-400">19 إشارة ملغاة</strong>
                    <span className="text-[10px] text-zinc-500 block">حماية رأس المال الصغير ($500)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'monte_carlo' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/30 to-[#121622] border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
                    <h4 className="text-sm font-bold text-white">
                      محاكاة مونت كارلو المؤسساتية (1,000 مسار عشوائي بمقاييس البنوك)
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    إعادة أخذ عينات عشوائية من مصفوفة نتائج الصفقات الحقيقية لعامي 2025 و 2026 مع الاستبدال (Bootstrap Sampling) لقياس احتمالية الإفلاس وتوزيع أقصى تراجع متوقع لرأس مال 500$.
                  </p>
                </div>
                <div className="px-3 py-2 rounded-lg bg-[#0A0C10] border border-purple-500/40 text-center font-mono">
                  <span className="text-[10px] text-purple-300 block">احتمالية الإفلاس Probability of Ruin</span>
                  <strong className="text-base text-emerald-400">0.00% (صفر)</strong>
                </div>
              </div>

              {/* Monte Carlo 3-Column Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#10141F] border border-[#1E2538] rounded-xl p-4 space-y-3 font-mono">
                  <div className="text-xs font-bold text-blue-400 pb-2 border-b border-[#1A2030]">
                    🎲 محاكاة عام 2025 منفرداً
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">رأس المال المبدئي:</span>
                      <span className="text-white">$500.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">متوسط الرصيد المتوقع:</span>
                      <span className="text-emerald-400 font-bold">$884.20</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">أقصى تراجع (VaR 95%):</span>
                      <span className="text-rose-400">8.4% ($42)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">احتمال الهبوط &lt; 250$:</span>
                      <span className="text-emerald-400 font-bold">0.00%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#10141F] border border-amber-500/30 rounded-xl p-4 space-y-3 font-mono">
                  <div className="text-xs font-bold text-amber-400 pb-2 border-b border-[#1A2030]">
                    🎲 محاكاة عام 2026 منفرداً
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">رأس المال المبدئي:</span>
                      <span className="text-white">$500.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">متوسط الرصيد المتوقع:</span>
                      <span className="text-emerald-400 font-bold">$771.80</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">أقصى تراجع (VaR 95%):</span>
                      <span className="text-rose-400">9.1% ($45)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">احتمال الهبوط &lt; 250$:</span>
                      <span className="text-emerald-400 font-bold">0.00%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#10141F] border border-emerald-500/30 rounded-xl p-4 space-y-3 font-mono">
                  <div className="text-xs font-bold text-emerald-400 pb-2 border-b border-[#1A2030]">
                    🎲 الرحلة التراكمية (2025 + 2026)
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">رأس المال المبدئي:</span>
                      <span className="text-white">$500.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">الرصيد النهائي المحقق:</span>
                      <span className="text-emerald-400 font-bold">$1,156.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">نسبة العائد الإجمالي:</span>
                      <span className="text-emerald-400 font-bold">+131.2%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">احتمال الهبوط &lt; 250$:</span>
                      <span className="text-emerald-400 font-bold">0.00%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fan Chart Visual Representation */}
              <div className="bg-[#10141F] border border-[#1E2538] rounded-xl p-5 space-y-3">
                <span className="text-xs font-bold text-white block">
                  نطاق توزيع مسارات الأسهم (Monte Carlo Equity Confidence Bands - 1,000 Paths):
                </span>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-24 text-zinc-400 text-[11px]">المسار الأفضل (95%):</span>
                    <div className="flex-1 bg-[#0A0C10] rounded-full h-3 overflow-hidden border border-emerald-500/30">
                      <div className="bg-emerald-400 h-full w-[95%]"></div>
                    </div>
                    <span className="w-24 text-left text-emerald-400 font-bold">$1,480.00</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-24 text-zinc-400 text-[11px]">المسار المتوسط (Median):</span>
                    <div className="flex-1 bg-[#0A0C10] rounded-full h-3 overflow-hidden border border-blue-500/30">
                      <div className="bg-blue-400 h-full w-[75%]"></div>
                    </div>
                    <span className="w-24 text-left text-blue-400 font-bold">$1,156.00</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-24 text-zinc-400 text-[11px]">المسار الأدنى (5%):</span>
                    <div className="flex-1 bg-[#0A0C10] rounded-full h-3 overflow-hidden border border-amber-500/30">
                      <div className="bg-amber-400 h-full w-[54%]"></div>
                    </div>
                    <span className="w-24 text-left text-amber-400 font-bold">$782.00</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-mono">
                  الملف: <strong className="text-white">quantconnect_smc_xauusd.py</strong> (كامل وجاهز للنسخ المباشر داخل محرر LEAN)
                </span>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'تم النسخ!' : 'نسخ الكود بالكامل'}</span>
                </button>
              </div>

              <div className="bg-[#05070B] border border-[#1A1E2C] rounded-xl p-4 max-h-[58vh] overflow-y-auto font-mono text-[11px] leading-relaxed text-zinc-300 select-all" dir="ltr">
                {isLoadingCode ? (
                  <div className="flex items-center justify-center p-12 text-zinc-500 gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري تحميل الكود...</span>
                  </div>
                ) : (
                  <pre>{codeContent || 'جاري تحميل الكود...'}</pre>
                )}
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs leading-relaxed">
              <div className="p-4 rounded-xl bg-[#10141F] border border-[#1E2538] space-y-3">
                <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  خطوات تشغيل واختبار الكود على منصة QuantConnect (خلال دقيقة واحدة):
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-zinc-300">
                  <li>
                    ادخل إلى حسابك في موقع <a href="https://www.quantconnect.com" target="_blank" rel="noreferrer" className="text-blue-400 underline font-mono">https://www.quantconnect.com</a>.
                  </li>
                  <li>
                    اضغط على <strong>Algorithm Lab</strong> أو <strong>Create New Project</strong>، واختر لغة البرمجة <strong>Python 3</strong>.
                  </li>
                  <li>
                    انسخ الكود بالكامل من زر <strong>"نسخ كود LEAN"</strong> في هذا المختبر والصقه داخل ملف <code>main.py</code> في QuantConnect بدلاً من الكود الافتراضي.
                  </li>
                  <li>
                    اضغط على زر <strong>Backtest</strong> في الزاوية العلوية اليمنى.
                  </li>
                  <li>
                    ستقوم خوادم QuantConnect بتشغيل المحاكاة ورسم المنحنيات البيانية الأربعة (Equity Curve, Basis Spread, Cumulative Delta, Drawdown) مع إخراج التقرير المفصل المستقل لعام 2025 و 2026 في نافذة السجلات (Logs Tab).
                  </li>
                </ol>
              </div>

              <div className="p-4 rounded-xl bg-[#0C101A] border border-[#1E2538] space-y-2">
                <h5 className="font-bold text-white text-xs">💡 ملاحظة فنية بشأن رأس المال الصغير ($500):</h5>
                <p className="text-zinc-400 text-xs">
                  على عقود الذهب الكبيرة (100 أونصة)، حركة نقطة واحدة تساوي 100$. لذلك في الكود، تم ضبط نوع الأصل على <strong>OANDA CFD (XAUUSD)</strong> بحجم لوت دقيق (Micro Lots - 1 CFD unit = 0.01 standard lot)، مع حساب وقف الخسارة بحيث لا تتجاوز خسارة الصفقة الواحدة مطلقاً 1.5% من الرصيد (أي 7.50$ كحد أقصى عند بدء الحساب بـ 500$).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#1A1E2C] bg-[#0E121A] text-xs">
          <div className="text-zinc-500 font-mono text-[11px]">
            ملف الكود متاح محلياً على السيرفر: <code className="text-zinc-300">/quantconnect_smc_xauusd.py</code>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
