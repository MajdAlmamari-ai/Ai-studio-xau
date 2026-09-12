import React, { useState } from 'react';
import { 
  FolderGit2, 
  FileCode, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  Archive,
  ChevronLeft,
  ExternalLink,
  FileJson
} from 'lucide-react';
import JSZip from 'jszip';
import { ALL_REPO_FILES } from '../data/repoTemplate';
import { RepoFile } from '../types';
import { downloadProjectZip, getFullDownloadUrl } from '../utils/downloadHelper';
import { downloadSourceCodeJson, downloadFullCodebaseMarkdown } from '../services/projectBundleService';
import { DownloadProjectModal } from './DownloadProjectModal';

export const RepoCodeCenter: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<RepoFile>(ALL_REPO_FILES[1]); // main.py default
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isDownloadingProject, setIsDownloadingProject] = useState(false);
  const [isDownloadingJson, setIsDownloadingJson] = useState(false);
  const [isDownloadingMd, setIsDownloadingMd] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const handleDownloadFullMd = async () => {
    setIsDownloadingMd(true);
    setDownloadMsg('جاري تجهيز وتنزيل ملف الأكواد الشامل (.MD)...');
    const ok = await downloadFullCodebaseMarkdown((status, msg) => {
      if (msg) setDownloadMsg(msg);
      if (status === 'success') {
        setTimeout(() => setDownloadMsg(null), 4000);
      }
    });
    setIsDownloadingMd(false);
    if (!ok) {
      setIsProjectModalOpen(true);
    }
  };

  const handleDownloadSourceJson = async () => {
    setIsDownloadingJson(true);
    setDownloadMsg('جاري تجميع وحفظ ملف project_source_code.json...');
    const ok = await downloadSourceCodeJson((status, msg) => {
      if (msg) setDownloadMsg(msg);
      if (status === 'success') {
        setTimeout(() => setDownloadMsg(null), 4000);
      }
    });
    setIsDownloadingJson(false);
    if (!ok) {
      setIsProjectModalOpen(true);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingleFile = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Add all repository files into the zip archive matching the exact directory hierarchy
      ALL_REPO_FILES.forEach((file) => {
        zip.file(file.path, file.content);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'xauusd-smc-bot-repo.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadFullProject = async () => {
    setIsDownloadingProject(true);
    setDownloadMsg('جاري جلب حزمة المشروع وتوليد ملف ZIP...');
    const ok = await downloadProjectZip((status, msg) => {
      if (msg) setDownloadMsg(msg);
      if (status === 'success') {
        setTimeout(() => setDownloadMsg(null), 4000);
      }
    });
    setIsDownloadingProject(false);
    if (!ok) {
      setIsProjectModalOpen(true);
    }
  };

  return (
    <div className="space-y-4 font-mono">
      
      {/* Top Banner: Repo Overview & Quick Download */}
      <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
        <div>
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-amber-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
              مركز كود مستودع GitHub وتصدير حزمة التشغيل الآلي
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            كود بايثون كامل وجاهز للنشر 24/7 سحابياً على GitHub Actions مجاناً وبدون خادم مدفوع
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direct Download of full single-file codebase markdown for expert audit */}
          <button
            id="download-full-codebase-md-btn"
            onClick={handleDownloadFullMd}
            disabled={isDownloadingMd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition active:scale-95 disabled:opacity-50 shadow-md cursor-pointer"
            title="تنزيل كافة ملفات المشروع مجمعة في ملف واحد متكامل لخبير التحليل والمراجعة"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isDownloadingMd ? 'جاري التحميل...' : 'تصدير الكود بملف واحد (.MD)'}</span>
          </button>

          {/* Direct Download of project_source_code.json */}
          <button
            id="download-consolidated-source-json-btn"
            onClick={handleDownloadSourceJson}
            disabled={isDownloadingJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition active:scale-95 disabled:opacity-50 shadow-md cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>{isDownloadingJson ? 'جاري التحميل...' : 'الكود الموحد (.JSON)'}</span>
          </button>

          <button
            id="download-full-project-archive-btn"
            onClick={handleDownloadFullProject}
            disabled={isDownloadingProject}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition active:scale-95 disabled:opacity-50 shadow-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloadingProject ? 'جاري التحميل...' : 'تحميل كامل المشروع (.ZIP)'}</span>
          </button>

          <button
            onClick={() => setIsProjectModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A0C10] hover:bg-[#1A1D26] text-emerald-400 text-xs font-semibold border border-emerald-500/40 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>خيارات التنزيل والرابط المباشر</span>
          </button>

          <button
            id="download-full-repo-zip-btn"
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition active:scale-95 disabled:opacity-50 shadow-md"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{isZipping ? 'جاري الضغط...' : 'بوت بايثون GitHub (.ZIP)'}</span>
          </button>

          <button
            id="download-single-file-btn"
            onClick={handleDownloadSingleFile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A0C10] hover:bg-[#1A1D26] text-zinc-300 text-xs font-medium border border-[#1A1D26] transition"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>تصدير الملف الحالي</span>
          </button>
        </div>
      </div>

      {downloadMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center justify-between">
          <span>{downloadMsg}</span>
          <button 
            onClick={() => setIsProjectModalOpen(true)}
            className="underline font-bold text-white hover:text-emerald-300 ml-2"
          >
            فتح نافذة التنزيل البديل
          </button>
        </div>
      )}

      {/* Quick Local Setup Card */}
      <div className="bg-[#12141B] border border-emerald-500/30 rounded-xl p-4 shadow-lg font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1A1D26]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">
                نسخة المشروع الكاملة الجاهزة للتشغيل (Full-Stack Production ZIP)
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                حزمة مضغوطة متكاملة تحتوي على كود الواجهة الأمامية بالكامل (React + Vite + Tailwind) وخادم الباك إند (Node.js + Express) ومحركات التحليل الكمي للذهب
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadFullProject}
              disabled={isDownloadingProject}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono transition shadow-lg disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloadingProject ? 'جاري التحميل...' : 'تنزيل الحزمة المباشر (~187 KB)'}</span>
            </button>
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0A0C10] hover:bg-[#1A1D26] text-zinc-300 text-xs font-mono border border-[#1A1D26] transition"
              title="خيارات إضافية"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>خيارات الرابط</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 text-xs font-mono">
          <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
            <span className="text-amber-400 font-bold block mb-1">1. فك ضغط الحزمة:</span>
            <code className="text-zinc-300 text-[11px] bg-[#12141B] px-2 py-1 rounded block border border-[#1A1D26] text-left dir-ltr">
              unzip xauusd-smc-quant-platform.zip
            </code>
          </div>
          <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
            <span className="text-cyan-400 font-bold block mb-1">2. تثبيت الحزم:</span>
            <code className="text-zinc-300 text-[11px] bg-[#12141B] px-2 py-1 rounded block border border-[#1A1D26] text-left dir-ltr">
              npm install
            </code>
          </div>
          <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
            <span className="text-emerald-400 font-bold block mb-1">3. بدء الخادم والواجهة:</span>
            <code className="text-zinc-300 text-[11px] bg-[#12141B] px-2 py-1 rounded block border border-[#1A1D26] text-left dir-ltr">
              npm run dev
            </code>
          </div>
        </div>
      </div>

      {/* Main Split: File Tree Explorer (Left) & Code Viewer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* Sidebar: File Tree (4 cols) */}
        <div className="lg:col-span-4 bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 shadow-lg space-y-3 font-sans">
          <div className="flex items-center justify-between border-b border-[#1A1D26] pb-2">
            <span className="text-xs font-bold text-zinc-300">
              هيكل ملفات المستودع
            </span>
            <span className="text-[10px] font-mono text-zinc-400 bg-[#0A0C10] px-2 py-0.5 rounded border border-[#1A1D26]">
              {ALL_REPO_FILES.length} ملفات جاهزة
            </span>
          </div>

          <div className="space-y-1 font-mono">
            {ALL_REPO_FILES.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-right px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-[#0A0C10]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                    <span className="truncate">{file.path}</span>
                  </div>
                  <ChevronLeft className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-400 opacity-100' : 'opacity-0'}`} />
                </button>
              );
            })}
          </div>

          {/* Quick GitHub Instructions */}
          <div className="pt-3 border-t border-[#1A1D26] text-xs text-zinc-400 space-y-2">
            <strong className="text-zinc-300 block text-xs">أوامر رفع المستودع إلى GitHub:</strong>
            <pre className="bg-[#0A0C10] p-2.5 rounded-lg border border-[#1A1D26] text-xs text-zinc-300 font-mono overflow-x-auto leading-relaxed dir-ltr text-left">
{`git init
git add .
git commit -m "feat: gold smc automated bot"
git branch -M main
git remote add origin https://github.com/YOUR_USER/xauusd-bot.git
git push -u origin main`}
            </pre>
          </div>
        </div>

        {/* Right Area: Code Display & Metadata (8 cols) */}
        <div className="lg:col-span-8 bg-[#12141B] border border-[#1A1D26] rounded-xl overflow-hidden shadow-lg flex flex-col font-sans">
          
          {/* File Header */}
          <div className="bg-[#0A0C10] px-4 py-3 border-b border-[#1A1D26] flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>{selectedFile.path}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {selectedFile.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="copy-file-content-btn"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12141B] hover:bg-[#1A1D26] text-zinc-300 text-xs font-semibold border border-[#1A1D26] transition active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                <span>{copied ? 'تم النسخ' : 'نسخ الكود'}</span>
              </button>
            </div>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="bg-[#0A0C10] p-4 font-mono text-xs text-zinc-300 max-h-[500px] overflow-y-auto overflow-x-auto leading-relaxed select-text dir-ltr text-left">
            <pre className="whitespace-pre font-mono">
              {selectedFile.content}
            </pre>
          </div>

          {/* Footer note */}
          <div className="bg-[#0A0C10] px-4 py-2.5 border-t border-[#1A1D26] text-xs text-zinc-500 flex items-center justify-between font-mono">
            <span>اللغة البرمجية: <strong className="text-zinc-300 uppercase">{selectedFile.language}</strong></span>
            <span>عدد الأسطر: {selectedFile.content.split('\n').length}</span>
          </div>

        </div>

      </div>

      {/* Full Project Codebase Download Modal */}
      <DownloadProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />

    </div>
  );
};
