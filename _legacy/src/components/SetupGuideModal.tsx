import React, { useState } from 'react';
import { 
  X, 
  BookOpen, 
  CheckCircle2, 
  KeyRound, 
  ExternalLink, 
  ShieldCheck, 
  PlayCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeStep, setActiveStep] = useState<number>(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-sans">
      <div className="bg-[#12141B] border border-[#1A1D26] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-[#1A1D26] flex items-center justify-between bg-[#0A0C10]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                دليل تشغيل وأتمتة بوت الذهب المؤسساتي (XAUUSD SMC)
              </h3>
              <p className="text-xs text-zinc-400">
                إعداد متكامل ودقيق لتشغيل البوت مجاناً 24/7 عبر تيليجرام و GitHub Actions
              </p>
            </div>
          </div>

          <button
            id="close-guide-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1D26] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Tabs */}
        <div className="flex border-b border-[#1A1D26] bg-[#0A0C10]/90 px-4 pt-2.5 gap-2 overflow-x-auto text-xs scrollbar-none">
          {[
            { id: 1, label: '١. توكن البوت' },
            { id: 2, label: '٢. معرف الدردشة' },
            { id: 3, label: '٣. أسرار GitHub' },
            { id: 4, label: '٤. تدفق العمل' },
            { id: 5, label: '٥. حل المشكلات' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStep(s.id)}
              className={`pb-2.5 px-3 font-bold border-b-2 transition whitespace-nowrap ${
                activeStep === s.id
                  ? 'border-amber-400 text-amber-400 font-extrabold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-zinc-300 leading-relaxed">
          {activeStep === 1 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>المرحلة الأولى: إنشاء بوت تيليجرام عبر @BotFather والحصول على التوكن</span>
              </h4>
              <p className="text-xs text-zinc-400">
                بوتات تيليجرام مجانية 100% ولا تتطلب أي خوادم معقدة. BotFather هو البوت الرسمي المسؤول عن إدارة البوتات.
              </p>
              <ol className="list-decimal list-inside space-y-2 bg-[#0A0C10] p-4 rounded-xl border border-[#1A1D26] text-xs">
                <li>افتح تطبيق تيليجرام وابحث عن <strong>@BotFather</strong>.</li>
                <li>أرسل له الأمر: <code>/newbot</code>.</li>
                <li>اختر اسماً للبوت، مثلاً: <code>Gold SMC Institutional</code>.</li>
                <li>اختر اسم مستخدم ينتهي بكلمة bot، مثلاً: <code>gold_smc_xau_bot</code>.</li>
                <li>سيرسل لك BotFather فوراً <strong>HTTP API Token</strong> الخاص بك (مثل: <code>7123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ</code>).</li>
                <li>انسخ التوكن واحتفظ به بأمان.</li>
              </ol>
              <div className="pt-1">
                <a
                  href="https://t.me/botfather"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400/10 text-amber-300 border border-amber-400/30 hover:bg-amber-400/20 font-bold text-xs"
                >
                  <span>فتح @BotFather في تيليجرام</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                <span>المرحلة الثانية: استخراج معرف الدردشة (CHAT_ID)</span>
              </h4>
              <p className="text-xs text-zinc-400">
                معرف الدردشة يحدد المكان الذي سيقوم البوت بإرسال التقرير المؤسساتي إليه (محادثة خاصة أو قناة تيليجرام).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#0A0C10] p-3.5 rounded-xl border border-[#1A1D26] space-y-2">
                  <strong className="text-amber-400 block font-bold">الخيار أ: محادثة شخصية خاصة</strong>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-300">
                    <li>تحدث مع <strong>@userinfobot</strong> على تيليجرام لمعرفة الـ ID الرقمي الخاص بك.</li>
                    <li><strong>شرط أساسي:</strong> ادخل إلى البوت الذي أنشأته واضغط <strong>/start</strong> ليسمح له بإرسال الرسائل لك!</li>
                  </ol>
                </div>

                <div className="bg-[#0A0C10] p-3.5 rounded-xl border border-[#1A1D26] space-y-2">
                  <strong className="text-amber-400 block font-bold">الخيار ب: قناة تيليجرام عامة أو خاصة</strong>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-300">
                    <li>أنشئ القناة في تيليجرام (مثل: "إشارات الذهب SMC").</li>
                    <li>أضف البوت في القناة كـ <strong>مسؤول (Admin)</strong> بصلاحية نشر الرسائل (Post Messages).</li>
                    <li>معرفات القنوات تبدأ دائماً بـ <code>-100</code> (مثل: <code>-1001928374650</code>).</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>المرحلة الثالثة: حفظ المتغيرات السرية بأمان في مستودع GitHub</span>
              </h4>
              <p className="text-xs text-zinc-400">
                يقوم محرك GitHub Actions بقراءة المتغيرات المشفرة تلقائياً في كل دورة تشغيل دورية (كل 15 دقيقة):
              </p>
              <ol className="list-decimal list-inside space-y-2 bg-[#0A0C10] p-4 rounded-xl border border-[#1A1D26] text-xs">
                <li>ادخل إلى مستودع المشروع الخاص بك على GitHub: <code>Xauusd-spot</code>.</li>
                <li>انتقل إلى <strong>Settings</strong> ثم <strong>Secrets and variables</strong> ثم <strong>Actions</strong>.</li>
                <li>اضغط على الزر الأخضر <strong>New repository secret</strong>.</li>
                <li>أضف السر الأول: الاسم <code>BOT_TOKEN</code> والقيمة هي توكن البوت.</li>
                <li>أضف السر الثاني: الاسم <code>CHAT_ID</code> والقيمة هي معرف القناة أو الشات.</li>
              </ol>
            </div>
          )}

          {activeStep === 4 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <PlayCircle className="w-4 h-4 text-amber-400" />
                <span>المرحلة الرابعة: تشغيل واختبار الأتمتة السحابية</span>
              </h4>
              <p className="text-xs text-zinc-400">
                بعد رفع ملفات المستودع إلى الفرع الرئيسي main:
              </p>
              <ol className="list-decimal list-inside space-y-2 bg-[#0A0C10] p-4 rounded-xl border border-[#1A1D26] text-xs">
                <li>انقر فوق تبويب <strong>Actions</strong> في مستودع GitHub الخاص بك.</li>
                <li>اختر سير العمل <strong>XAUUSD SMC Trading Bot</strong> من القائمة الجانبية.</li>
                <li>اضغط على <strong>Run workflow</strong> لتشغيل تجربة يدوية فورية.</li>
                <li>ستقوم بيئة خوادم GitHub بتشغيل بيئة Python 3.10 وتحليل الهيكل وإرسال التقرير لقناتك في غضون 18 ثانية.</li>
                <li>افتح قناتك في تيليجرام لمشاهدة التقرير الفوري!</li>
              </ol>
            </div>
          )}

          {activeStep === 5 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-rose-400" />
                <span>الأسئلة الشائعة وحل المشكلات المحتملة</span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-[#0A0C10] border border-[#1A1D26]">
                  <strong className="text-rose-400 block font-bold">خطأ: "Unauthorized: Invalid Bot Token"</strong>
                  <p className="text-zinc-400 mt-1">
                    تأكد من عدم وجود مسافات فارغة في بداية أو نهاية التوكن عند نسخه إلى GitHub Secrets.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#0A0C10] border border-[#1A1D26]">
                  <strong className="text-rose-400 block font-bold">خطأ: "Chat not found"</strong>
                  <p className="text-zinc-400 mt-1">
                    يجب أن تضغط أولاً على <code>/start</code> داخل محادثة البوت، أو في حالة القناة تأكد من إضافة البوت كـ مسؤول مع صلاحية النشر.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#0A0C10] border border-[#1A1D26]">
                  <strong className="text-amber-400 block font-bold">هل تشغيل GitHub Actions مدفوع أم مجاني؟</strong>
                  <p className="text-zinc-400 mt-1">
                    المستودعات العامة على GitHub توفر دقائق تشغيل لا نهائية مجاناً 100%، وتكفي لتشغيل البوت 24 ساعة طوال الشهر بدون أي رسوم.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1A1D26] bg-[#0A0C10] flex items-center justify-between text-xs font-mono">
          <div className="text-xs text-zinc-500 font-sans">
            الخطوة {activeStep} من 5
          </div>
          <div className="flex items-center gap-2">
            {activeStep > 1 && (
              <button
                onClick={() => setActiveStep(activeStep - 1)}
                className="px-3 py-1.5 rounded-lg bg-[#12141B] hover:bg-[#1A1D26] text-zinc-300 text-xs font-medium border border-[#1A1D26] flex items-center gap-1 font-sans"
              >
                <span>السابق</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {activeStep < 5 ? (
              <button
                onClick={() => setActiveStep(activeStep + 1)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold flex items-center gap-1 font-sans"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>الخطوة التالية</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold font-sans"
              >
                إغلاق الدليل
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
