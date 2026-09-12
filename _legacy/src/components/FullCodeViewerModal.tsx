import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  FileCode2, 
  Layers, 
  FolderTree, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  FileText,
  Shield,
  Activity,
  Server
} from 'lucide-react';
import { fetchFullCodebaseContent } from '../services/projectBundleService';
import { copyTextToClipboard } from '../utils/clipboardHelper';

interface FullCodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FullCodeViewerModal: React.FC<FullCodeViewerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | string>('all');
  const [fullCode, setFullCode] = useState<string>('');
  const [categoryCode, setCategoryCode] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const categories = [
    { id: 'all', nameAr: 'كامل الأكواد (ملف واحد شامل)', icon: FileCode2 },
    { id: 'ui_and_chart_components', nameAr: '1. مكونات الواجهة والشارت', icon: Layers },
    { id: 'data_engine_and_apis', nameAr: '2. محركات البيانات والأسعار', icon: Activity },
    { id: 'smc_quant_algorithms', nameAr: '3. خوارزميات SMC الذكية', icon: FolderTree },
    { id: 'risk_management_and_signals', nameAr: '4. إدارة المخاطر والتوصيات', icon: Shield },
    { id: 'config_and_server_files', nameAr: '5. ملفات الخادم والإعدادات', icon: Server },
  ];

  // Load all code when modal opens
  useEffect(() => {
    if (isOpen && !fullCode) {
      setLoading(true);
      setErrorMsg(null);
      fetchFullCodebaseContent()
        .then((text) => {
          setFullCode(text);
        })
        .catch((err) => {
          console.error('Failed to load codebase:', err);
          setErrorMsg('تعذر جلب الأكواد تلقائياً، يمكنك تجربة الرابط المباشر في الأسفل.');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, fullCode]);

  // Load category code if selected
  useEffect(() => {
    if (isOpen && activeTab !== 'all' && !categoryCode[activeTab]) {
      fetch(`/api/project/category-content/${activeTab}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.content) {
            setCategoryCode((prev) => ({ ...prev, [activeTab]: data.content }));
          }
        })
        .catch((e) => console.warn('Failed to load category code:', e));
    }
  }, [isOpen, activeTab, categoryCode]);

  if (!isOpen) return null;

  const currentDisplayCode = activeTab === 'all' ? fullCode : (categoryCode[activeTab] || 'جاري تحميل أكواد هذا القسم...');

  const filteredCode = searchTerm 
    ? currentDisplayCode.split('\n').filter(line => line.toLowerCase().includes(searchTerm.toLowerCase())).join('\n')
    : currentDisplayCode;

  const handleCopyCurrent = async () => {
    const textToCopy = currentDisplayCode;
    const ok = await copyTextToClipboard(textToCopy);
    if (ok) {
      setCopySuccess(activeTab === 'all' ? 'تم نسخ جميع أكواد المشروع بالكامل للحافظة!' : 'تم نسخ أكواد هذا القسم للحافظة بنجاح!');
      setTimeout(() => setCopySuccess(null), 3500);
    } else {
      setErrorMsg('لم يتمكن المتصفح من النسخ التلقائي. يمكنك تحديد النص يدوياً ونسخه (Ctrl + A ثم Ctrl + C).');
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  const directFileUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/xauusd_smc_quant_full_codebase.md` 
    : '/xauusd_smc_quant_full_codebase.md';

  const handleCopyDirectUrl = async () => {
    const ok = await copyTextToClipboard(directFileUrl);
    if (ok) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-[#0A0D14] border border-[#1A2234] rounded-2xl w-full max-w-5xl h-[92vh] shadow-2xl flex flex-col font-sans"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1A2234] bg-[#0F1420] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  مركز قراءة ونسخ أكواد المشروع الكاملة (دون الحاجة للتنزيل)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                  22,660 سطر كود
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                يمكنك نسخ الأكواد كاملة أو مقسمة إلى 5 أقسام للصقها لخبير البرمجة أو لأي محادثة ذكاء اصطناعي فوراً.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1A2234] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 p-2 px-3 border-b border-[#1A2234] bg-[#0D111A] overflow-x-auto shrink-0 no-scrollbar">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500 text-black shadow-md font-bold'
                    : 'bg-[#121726] text-zinc-300 hover:bg-[#1A2234] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.nameAr}</span>
              </button>
            );
          })}
        </div>

        {/* Action and Alert Bar */}
        <div className="p-3 border-b border-[#1A2234] bg-[#0A0D14] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث في سطور الكود..."
                className="w-full bg-[#121726] border border-[#1A2234] rounded-lg pr-8 pl-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="text-[11px] text-zinc-400 hover:text-white"
              >
                مسح
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Primary Action: Copy Code */}
            <button
              id="copy-code-direct-btn"
              onClick={handleCopyCurrent}
              disabled={loading || !currentDisplayCode}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs sm:text-sm transition shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              <span>{copySuccess ? 'تم النسخ بنجاح! ✅' : (activeTab === 'all' ? 'نسخ كافة الأكواد للحافظة (Copy All)' : 'نسخ هذا القسم للحافظة')}</span>
            </button>

            {/* Direct Link in New Tab */}
            <a
              href={directFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#161B26] hover:bg-[#202838] text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition"
              title="فتح الملف مباشرة في علامة تبويب جديدة خارج إطار المعاينة"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح الرابط المباشر في صفحة جديدة</span>
            </a>

            {/* Copy Direct Link */}
            <button
              onClick={handleCopyDirectUrl}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#121726] hover:bg-[#1A2234] text-zinc-300 text-xs font-mono transition cursor-pointer"
              title="نسخ رابط الملف لفتحه في أي متصفح"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'تم نسخ الرابط' : 'نسخ الرابط'}</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {copySuccess && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{copySuccess} يمكنك الآن لصقه مباشرة (Ctrl + V) في محادثة الخبير أو في أي محرر نصوص.</span>
          </div>
        )}

        {errorMsg && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Code View Area */}
        <div className="flex-1 p-3 sm:p-4 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-cyan-400">
              <span className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></span>
              <span className="text-xs font-mono">جاري استخراج وتجميع 22,660 سطر كود...</span>
            </div>
          ) : (
            <div className="flex-1 rounded-xl bg-[#07090E] border border-[#161B26] p-3 sm:p-4 overflow-auto font-mono text-[11px] sm:text-xs text-zinc-300 leading-relaxed select-all">
              <pre className="whitespace-pre-wrap font-mono text-zinc-200 selection:bg-cyan-500/30 selection:text-white">
                {filteredCode || 'لا توجد أسطر تطابق نص البحث.'}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer with Direct Instruction */}
        <div className="p-3 px-4 border-t border-[#1A2234] bg-[#0D111A] flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>نصيحة: إذا حظر المتصفح التحميل من إطار المعاينة، يمكنك نسخ الكود أعلاه مباشرة أو فتح الرابط في نافذة جديدة.</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            {activeTab === 'all' ? '22,660 Lines • 90 Files' : 'Section View'}
          </div>
        </div>

      </div>
    </div>
  );
};
