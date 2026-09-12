import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  Archive, 
  AlertCircle, 
  CheckCircle2, 
  Terminal, 
  FileCode2,
  HardDrive,
  FileJson,
  FileText,
  Layers,
  Shield,
  Activity,
  Server,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Code
} from 'lucide-react';
import { downloadProjectZip, getFullDownloadUrl } from '../utils/downloadHelper';
import { 
  downloadSourceCodeJson, 
  downloadFullCodebaseMarkdown,
  downloadFullCodebaseText,
  fetchFullCodebaseContent,
  fetchProjectSourceBundle, 
  ProjectSourceBundle 
} from '../services/projectBundleService';
import { copyTextToClipboard } from '../utils/clipboardHelper';
import { FullCodeViewerModal } from './FullCodeViewerModal';

interface DownloadProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadProjectModal: React.FC<DownloadProjectModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isCopiedZip, setIsCopiedZip] = useState<boolean>(false);
  const [isCopiedJson, setIsCopiedJson] = useState<boolean>(false);
  const [isCopiedMdLink, setIsCopiedMdLink] = useState<boolean>(false);
  const [isCopyingAll, setIsCopyingAll] = useState<boolean>(false);
  const [isCopiedAll, setIsCopiedAll] = useState<boolean>(false);
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState<boolean>(false);
  const [bundleData, setBundleData] = useState<ProjectSourceBundle | null>(null);
  const [loadingBundle, setLoadingBundle] = useState<boolean>(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('ui_and_chart_components');
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<{ name: string; content: string } | null>(null);
  const [copiedFile, setCopiedFile] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && !bundleData) {
      setLoadingBundle(true);
      fetchProjectSourceBundle()
        .then((data) => setBundleData(data))
        .catch((err) => console.warn('Could not load bundle metadata:', err))
        .finally(() => setLoadingBundle(false));
    }
  }, [isOpen, bundleData]);

  if (!isOpen) return null;

  const zipDownloadUrl = getFullDownloadUrl();
  const jsonDownloadUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/project/download-source-json`;
  const mdDownloadUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/project/download-full-codebase-md`;
  const txtDownloadUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/project/download-full-codebase-txt`;

  const handleStartMarkdownDownload = async () => {
    setDownloadStatus('downloading');
    setStatusMessage('جاري تجهيز وتنزيل ملف الأكواد الشامل (Markdown .MD)...');
    await downloadFullCodebaseMarkdown((status, message) => {
      setDownloadStatus(status);
      if (message) setStatusMessage(message);
    });
  };

  const handleStartTextDownload = async () => {
    setDownloadStatus('downloading');
    setStatusMessage('جاري تجهيز وتنزيل ملف الأكواد الشامل (Text .TXT)...');
    await downloadFullCodebaseText((status, message) => {
      setDownloadStatus(status);
      if (message) setStatusMessage(message);
    });
  };

  const handleCopyAllCodebase = async () => {
    try {
      setIsCopyingAll(true);
      setDownloadStatus('downloading');
      setStatusMessage('جاري استخراج وتجميع نص كافة الأكواد لنسخها إلى الحافظة...');
      const fullText = await fetchFullCodebaseContent();
      const ok = await copyTextToClipboard(fullText);
      if (ok) {
        setIsCopiedAll(true);
        setDownloadStatus('success');
        setStatusMessage('تم نسخ كافة الأكواد المصدرية للمشروع بالكامل إلى الحافظة بنجاح!');
        setTimeout(() => setIsCopiedAll(false), 3500);
      } else {
        setDownloadStatus('error');
        setStatusMessage('تعذر النسخ التلقائي؛ اضغط على زر "فتح عارض الأكواد" لتحديد ونسخ الكود يدوياً.');
      }
    } catch (err: any) {
      setDownloadStatus('error');
      setStatusMessage('تعذر استخراج الأكواد؛ استخدم زر "فتح عارض الأكواد" بالأسفل.');
    } finally {
      setIsCopyingAll(false);
    }
  };

  const handleCopyMdUrl = async () => {
    const ok = await copyTextToClipboard(mdDownloadUrl);
    if (ok) {
      setIsCopiedMdLink(true);
      setTimeout(() => setIsCopiedMdLink(false), 3000);
    }
  };

  const handleStartZipDownload = async () => {
    setDownloadStatus('downloading');
    setStatusMessage('جاري استدعاء ملف الـ ZIP وتوليد رابط التنزيل...');
    await downloadProjectZip((status, message) => {
      setDownloadStatus(status);
      if (message) setStatusMessage(message);
    });
  };

  const handleStartJsonDownload = async () => {
    setDownloadStatus('downloading');
    setStatusMessage('جاري تجميع وحفظ ملف الكود المصدري الكامل project_source_code.json...');
    await downloadSourceCodeJson((status, message) => {
      setDownloadStatus(status);
      if (message) setStatusMessage(message);
    });
  };

  const handleCopyZipUrl = async () => {
    try {
      await navigator.clipboard.writeText(zipDownloadUrl);
      setIsCopiedZip(true);
      setTimeout(() => setIsCopiedZip(false), 3000);
    } catch {
      setIsCopiedZip(true);
      setTimeout(() => setIsCopiedZip(false), 3000);
    }
  };

  const handleCopyJsonUrl = async () => {
    try {
      await navigator.clipboard.writeText(jsonDownloadUrl);
      setIsCopiedJson(true);
      setTimeout(() => setIsCopiedJson(false), 3000);
    } catch {
      setIsCopiedJson(true);
      setTimeout(() => setIsCopiedJson(false), 3000);
    }
  };

  const handleCopyPreviewedCode = async () => {
    if (!selectedFileForPreview) return;
    try {
      await navigator.clipboard.writeText(selectedFileForPreview.content);
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 2500);
    } catch (err) {
      console.error('Failed to copy file:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-[#0A0D14] border border-[#1A2234] rounded-2xl w-full max-w-4xl max-h-[94vh] overflow-y-auto shadow-2xl flex flex-col font-sans"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#1A2234] bg-[#0F1420]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  مركز تنزيل وتصدير الكود المصدري الكامل للمشروع
                </h3>
                <span className="text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  {bundleData ? `${bundleData.totalFiles} ملفاً • ${bundleData.totalLines.toLocaleString('en-US')} سطراً` : 'كامل بدون اختصار'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                تجميع كافة مكونات الواجهة، محركات الأسعار، خوارزميات SMC، وإدارة المخاطر في ملف واحد موحد (JSON) أو أرشيف مضغوط (ZIP)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A2234] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5">
          
          {/* Status Alert if triggered */}
          {downloadStatus === 'downloading' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0"></span>
              <span>{statusMessage}</span>
            </div>
          )}

          {downloadStatus === 'success' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {downloadStatus === 'error' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* SPECIAL FEATURED SECTION: SINGLE FILE FULL CODEBASE FOR EXPERT AUDITING */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#121929] via-[#0E1524] to-[#121929] border-2 border-cyan-500/50 shadow-xl shadow-cyan-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E293B] pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
                  <FileCode2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-bold text-white font-sans">
                      تصدير كافة أكواد المشروع في ملف واحد متكامل (للخبير ومراجعة الأخطاء)
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                      ملف واحد شامل 🌟
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 font-sans">
                    يحتوي على النص الكامل لجميع ملفات المشروع (المكونات، المحركات، خوارزميات SMC، وإدارة المخاطر) دون نقصان، مجهز بتنسيق الماركداون والنص العادي لإرساله لخبير التدقيق أو الذكاء الاصطناعي لفحص الأخطاء.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Instant In-App Viewer & Copier (100% Reliable without downloading) */}
            <div className="mb-4">
              <button
                id="open-full-code-viewer-btn"
                onClick={() => setIsCodeViewerOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-black font-black text-xs sm:text-sm transition shadow-lg active:scale-98 cursor-pointer"
              >
                <FileCode2 className="w-5 h-5" />
                <span>👁️ فتح عارض الأكواد ونسخها بالكامل على الشاشة (حل فوري 100% دون الحاجة للتنزيل)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Button 1: Markdown .MD */}
              <button
                onClick={handleStartMarkdownDownload}
                disabled={downloadStatus === 'downloading'}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs sm:text-sm transition shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
                title="تنزيل الملف بتنسيق Markdown المقروء مع تلوين وتنسيق الأكواد"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل ملف واحد (.MD)</span>
              </button>

              {/* Button 2: Plain Text .TXT */}
              <button
                onClick={handleStartTextDownload}
                disabled={downloadStatus === 'downloading'}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#1A2234] hover:bg-[#232F47] text-cyan-300 border border-cyan-500/40 font-bold text-xs sm:text-sm transition shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
                title="تنزيل الملف كنص عادي متوافق مع أي محرر نصوص"
              >
                <FileText className="w-4 h-4" />
                <span>تنزيل ملف واحد (.TXT)</span>
              </button>

              {/* Button 3: Copy All */}
              <button
                onClick={handleCopyAllCodebase}
                disabled={isCopyingAll}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#161B26] hover:bg-[#1F2737] text-emerald-400 border border-emerald-500/40 font-bold text-xs sm:text-sm transition shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
                title="نسخ كافة الأكواد المضمنة في الملف مباشرة للحافظة لصقها لأي خبير"
              >
                {isCopiedAll ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{isCopiedAll ? 'تم نسخ جميع الأكواد!' : (isCopyingAll ? 'جاري النسخ...' : 'نسخ كافة الأكواد')}</span>
              </button>
            </div>

            {/* Troubleshooting Sandbox Notice with Copyable URL */}
            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300">لم تستطع التحميل من المتصفح؟</strong>
                  <span className="text-zinc-300 mr-1">
                    المتصفحات تحظر أحياناً التنزيل التلقائي داخل إطار المعاينة (iFrame). الحل الأسرع: استخدم زر <strong className="text-cyan-300">"فتح عارض الأكواد"</strong> أعلاه، أو انسخ الرابط المباشر وافتحه في متصفحك:
                  </span>
                </div>
              </div>
              <button
                onClick={handleCopyMdUrl}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-[11px] transition cursor-pointer"
              >
                {isCopiedMdLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopiedMdLink ? 'تم نسخ الرابط المباشر!' : 'نسخ رابط الملف الخارجي'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 pt-3 mt-3 border-t border-[#1A2234]">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-mono font-bold">✓ 100% كامل وبدون أي اختصار</span>
                <span>•</span>
                <span>يتضمن توثيق المعمارية وتوجيهات SMC وفهرس الملفات بالكامل</span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="/xauusd_smc_quant_full_codebase.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-300 transition flex items-center gap-1 text-cyan-400"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>عرض الملف كاملاً في المتصفح</span>
                </a>
              </div>
            </div>
          </div>

          {/* TWO PRIMARY DOWNLOAD OPTIONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* OPTION 1: Consolidated Single Source JSON File */}
            <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-[#121726] to-[#0A0D14] border-2 border-amber-500/40 hover:border-amber-500/70 transition flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-sm text-zinc-100 font-sans">
                      1. ملف الكود المصدري الموحد (JSON)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                    مطلوب المستخدم 🔥
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-3">
                  ملف واحد متكامل (<strong>project_source_code.json</strong>) يضم كافة ملفات المشروع مصنفة في 5 أقسام رئيسية وبأكوادها الكاملة غير المختصرة.
                </p>
                <div className="space-y-1 text-[11px] text-zinc-400 font-mono mb-4">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>يحتوي جميع المكونات، المحركات، الخوارزميات، والإعدادات.</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>قابل للاستيراد البرمجي والتحليل المباشر دون فك ضغط.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#1A2234]">
                <button
                  id="download-source-json-btn"
                  onClick={handleStartJsonDownload}
                  disabled={downloadStatus === 'downloading'}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs sm:text-sm transition shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل ملف project_source_code.json</span>
                </button>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                  <a
                    href="/api/project/download-source-json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-amber-400 transition flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>تنزيل في تبويب مستقل</span>
                  </a>
                  <button
                    onClick={handleCopyJsonUrl}
                    className="hover:text-amber-400 transition flex items-center gap-1 cursor-pointer font-mono"
                  >
                    {isCopiedJson ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopiedJson ? 'تم نسخ الرابط' : 'نسخ رابط الـ JSON'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* OPTION 2: Complete Project ZIP Archive */}
            <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-[#121726] to-[#0A0D14] border border-emerald-500/40 hover:border-emerald-500/70 transition flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Archive className="w-5 h-5 text-emerald-400" />
                    <span className="font-bold text-sm text-zinc-100 font-sans">
                      2. أرشيف المشروع الكامل (.ZIP)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    جاهز للتشغيل ⚡
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-3">
                  حزمة مضغوطة أصلية (<strong>xauusd-smc-quant-platform.zip</strong>) بكامل هيكل المجلدات والملفات جاهزة للتشغيل بـ npm run dev.
                </p>
                <div className="space-y-1 text-[11px] text-zinc-400 font-mono mb-4">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>تحتوي على مجلدات src و server و public و package.json.</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>فك الضغط والتشغيل المباشر عبر Node.js + Vite.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#1A2234]">
                <button
                  id="download-full-zip-btn"
                  onClick={handleStartZipDownload}
                  disabled={downloadStatus === 'downloading'}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs sm:text-sm transition shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل حزمة المشروع كاملة (.ZIP)</span>
                </button>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                  <a
                    href="/api/download/project-zip"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-emerald-400 transition flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>فتح في تبويب مستقل</span>
                  </a>
                  <button
                    onClick={handleCopyZipUrl}
                    className="hover:text-emerald-400 transition flex items-center gap-1 cursor-pointer font-mono"
                  >
                    {isCopiedZip ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopiedZip ? 'تم نسخ الرابط' : 'نسخ رابط الـ ZIP'}</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* 5 CATEGORIES CLASSIFICATION TREE */}
          <div className="bg-[#0D111A] border border-[#1A2234] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#1A2234] pb-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  فهرس الأقسام الخمسة المصنفة داخل ملف الكود المصدري:
                </h4>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">
                {bundleData ? `${bundleData.categories.reduce((acc, c) => acc + c.filesCount, 0)} ملفاً متاحاً` : 'جاري الفهرسة...'}
              </span>
            </div>

            <div className="space-y-2">
              {bundleData?.categories.map((cat) => {
                const isExpanded = expandedCategory === cat.id;
                const catFiles = bundleData.files.filter((f) => f.category === cat.id);

                return (
                  <div
                    key={cat.id}
                    className="border border-[#1A2234] rounded-lg bg-[#080B12] overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                      className="w-full flex items-center justify-between p-3 text-right hover:bg-[#101522] transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        {cat.id === 'ui_and_chart_components' && <Layers className="w-4 h-4 text-cyan-400" />}
                        {cat.id === 'data_engine_and_apis' && <Activity className="w-4 h-4 text-amber-400" />}
                        {cat.id === 'smc_quant_algorithms' && <Code className="w-4 h-4 text-emerald-400" />}
                        {cat.id === 'risk_management_and_signals' && <Shield className="w-4 h-4 text-rose-400" />}
                        {cat.id === 'config_and_server_files' && <Server className="w-4 h-4 text-purple-400" />}
                        <div>
                          <span className="text-xs font-bold text-zinc-200 block font-sans">
                            {cat.nameAr}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-sans">
                            {cat.descriptionAr}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs shrink-0">
                        <span className="px-2 py-0.5 rounded bg-[#131826] text-zinc-300 border border-[#212A40]">
                          {cat.filesCount} ملفاً ({cat.linesCount.toLocaleString('en-US')} سطر)
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-3 border-t border-[#1A2234] bg-[#07090F] space-y-1.5 max-h-56 overflow-y-auto">
                        {catFiles.map((f) => (
                          <div
                            key={f.relativePath}
                            className="flex items-center justify-between p-1.5 rounded bg-[#0D121D] hover:bg-[#141B2B] text-xs font-mono transition"
                          >
                            <div className="flex items-center gap-2 text-zinc-300 truncate">
                              <FileCode2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                              <span className="truncate text-left dir-ltr">{f.relativePath}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-zinc-500">
                                {f.linesCount} سطر • {(f.sizeBytes / 1024).toFixed(1)} KB
                              </span>
                              <button
                                onClick={() => setSelectedFileForPreview({ name: f.relativePath, content: f.content })}
                                className="px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] font-sans transition cursor-pointer"
                              >
                                معاينة
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick File Preview Modal if requested */}
          {selectedFileForPreview && (
            <div className="p-3.5 rounded-xl bg-[#080B12] border border-indigo-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs text-indigo-300 text-left dir-ltr">
                  <Code className="w-4 h-4" />
                  <span>{selectedFileForPreview.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyPreviewedCode}
                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded bg-[#141B2B] hover:bg-[#1C253B] text-zinc-200 border border-[#252E46] transition cursor-pointer"
                  >
                    {copiedFile ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedFile ? 'تم النسخ!' : 'نسخ الكود'}</span>
                  </button>
                  <button
                    onClick={() => setSelectedFileForPreview(null)}
                    className="text-zinc-500 hover:text-white text-xs p-1"
                  >
                    إغلاق المعاينة ✕
                  </button>
                </div>
              </div>
              <pre className="p-3 rounded-lg bg-[#05070A] border border-[#1A2234] font-mono text-[11px] text-zinc-300 max-h-48 overflow-y-auto text-left dir-ltr">
                {selectedFileForPreview.content}
              </pre>
            </div>
          )}

          {/* Instructions for Quick Local Execution */}
          <div className="bg-[#0D111A] border border-[#1A2234] rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>خطوات تشغيل المشروع محلياً بعد التنزيل:</span>
            </div>
            <div className="bg-[#07090F] p-2.5 rounded-lg border border-[#1A2234] font-mono text-[11px] text-zinc-300 space-y-1 text-left dir-ltr">
              <div className="text-zinc-500"># 1. إذا قمت بتنزيل ملف الـ ZIP:</div>
              <div className="text-amber-400">unzip xauusd-smc-quant-platform.zip && cd xauusd-smc-quant-platform</div>
              <div className="text-zinc-500 mt-1"># 2. تثبيت الحزم وتشغيل الخادم المدمج مع محرك SMC:</div>
              <div className="text-emerald-400">npm install && npm run dev</div>
              <div className="text-zinc-500 mt-1"># 3. إذا قمت بتنزيل project_source_code.json، يمكنك فك الملفات عبر سكربت بسيط أو قراءتها مباشرة.</div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1A2234] bg-[#0F1420] flex items-center justify-between">
          <span className="text-xs text-zinc-400 font-sans">
            منصة XAUUSD SMC Quant المؤسساتية • إصدار الإنتاج v2.5.0
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1A2234] hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>

      {/* Instant In-App Full Code Viewer & Copier */}
      <FullCodeViewerModal
        isOpen={isCodeViewerOpen}
        onClose={() => setIsCodeViewerOpen(false)}
      />
    </div>
  );
};
