import { ProjectSourceBundle } from '../../server/projectBundleService';

export type { ProjectSourceBundle, ProjectSourceFile } from '../../server/projectBundleService';

/**
 * Fetch the complete project source bundle (all source files, no truncation)
 */
export async function fetchProjectSourceBundle(force = false): Promise<ProjectSourceBundle> {
  const res = await fetch(`/api/project/source-bundle${force ? '?force=true' : ''}`);
  if (!res.ok) {
    throw new Error(`Failed to load source bundle: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Download the full project_source_code.json directly
 */
export async function downloadSourceCodeJson(
  onStatusChange?: (status: 'downloading' | 'success' | 'error', message?: string) => void
): Promise<boolean> {
  if (onStatusChange) {
    onStatusChange('downloading', 'جاري جلب ملف الكود المصدري الموحد (JSON)...');
  }

  const endpoints = [
    '/api/project/download-source-json',
    '/project_source_code.json',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;

      const blob = await response.blob();
      if (!blob || blob.size === 0) continue;

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'project_source_code.json';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        try {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } catch (e) {}
      }, 3000);

      if (onStatusChange) {
        onStatusChange('success', 'تم تنزيل ملف الكود المصدري الكامل project_source_code.json بنجاح! ✅');
      }
      return true;
    } catch (err) {
      console.warn(`Failed download from ${endpoint}:`, err);
    }
  }

  // Fallback: window.open
  try {
    const newWindow = window.open('/api/project/download-source-json', '_blank');
    if (newWindow) {
      if (onStatusChange) {
        onStatusChange('success', 'تم فتح ملف الكود المصدري في نافذة جديدة للتنزيل المباشر!');
      }
      return true;
    }
  } catch (e) {}

  if (onStatusChange) {
    onStatusChange('error', 'تعذر التنزيل التلقائي. يمكنك فتح الرابط المباشر من المتصفح.');
  }
  return false;
}

/**
 * Download the single unified Markdown file (.md) containing all codes for an expert
 */
export async function downloadFullCodebaseMarkdown(
  onStatusChange?: (status: 'downloading' | 'success' | 'error', message?: string) => void
): Promise<boolean> {
  if (onStatusChange) {
    onStatusChange('downloading', 'جاري تجهيز وتنزيل ملف الأكواد الشامل (Markdown .MD)...');
  }

  const endpoints = [
    '/api/project/download-full-codebase-md',
    '/xauusd_smc_quant_full_codebase.md',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;

      const blob = await response.blob();
      if (!blob || blob.size === 0) continue;

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'xauusd_smc_quant_full_codebase.md';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        try {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } catch (e) {}
      }, 3000);

      if (onStatusChange) {
        onStatusChange('success', 'تم تنزيل ملف الأكواد الشامل xauusd_smc_quant_full_codebase.md بنجاح! ⚡');
      }
      return true;
    } catch (err) {
      console.warn(`Failed markdown download from ${endpoint}:`, err);
    }
  }

  // Fallback: window.open
  try {
    const newWindow = window.open('/api/project/download-full-codebase-md', '_blank');
    if (newWindow) {
      if (onStatusChange) {
        onStatusChange('success', 'تم فتح رابط ملف الماركدوان في نافذة جديدة!');
      }
      return true;
    }
  } catch (e) {}

  if (onStatusChange) {
    onStatusChange('error', 'تعذر التنزيل التلقائي لملف الماركدوان.');
  }
  return false;
}

/**
 * Download the single unified Text file (.txt) containing all codes for universal opening
 */
export async function downloadFullCodebaseText(
  onStatusChange?: (status: 'downloading' | 'success' | 'error', message?: string) => void
): Promise<boolean> {
  if (onStatusChange) {
    onStatusChange('downloading', 'جاري تجهيز وتنزيل ملف الأكواد الشامل (Text .TXT)...');
  }

  const endpoints = [
    '/api/project/download-full-codebase-txt',
    '/xauusd_smc_quant_full_codebase.txt',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;

      const blob = await response.blob();
      if (!blob || blob.size === 0) continue;

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'xauusd_smc_quant_full_codebase.txt';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        try {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } catch (e) {}
      }, 3000);

      if (onStatusChange) {
        onStatusChange('success', 'تم تنزيل ملف الأكواد الشامل xauusd_smc_quant_full_codebase.txt بنجاح! ⚡');
      }
      return true;
    } catch (err) {
      console.warn(`Failed text download from ${endpoint}:`, err);
    }
  }

  // Fallback: window.open
  try {
    const newWindow = window.open('/api/project/download-full-codebase-txt', '_blank');
    if (newWindow) {
      if (onStatusChange) {
        onStatusChange('success', 'تم فتح رابط ملف النص في نافذة جديدة!');
      }
      return true;
    }
  } catch (e) {}

  if (onStatusChange) {
    onStatusChange('error', 'تعذر التنزيل التلقائي لملف النص.');
  }
  return false;
}

/**
 * Fetch the full codebase raw text content for clipboard copying
 */
export async function fetchFullCodebaseContent(): Promise<string> {
  try {
    const res = await fetch('/api/project/full-codebase-content');
    if (res.ok) {
      const data = await res.json();
      if (data.content) return data.content;
    }
  } catch (e) {}

  // Fallback to static
  const staticRes = await fetch('/xauusd_smc_quant_full_codebase.md');
  if (staticRes.ok) {
    return await staticRes.text();
  }
  throw new Error('تعذر تحميل محتوى الكود الشامل');
}
