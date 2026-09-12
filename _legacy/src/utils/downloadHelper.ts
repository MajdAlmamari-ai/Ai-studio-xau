/**
 * Robust Client-Side Download Helper for iFrame Environments
 * Handles sandboxed iframes by attempting Blob download and fallback.
 */

export async function downloadProjectZip(
  onStatusChange?: (status: 'downloading' | 'success' | 'error', message?: string) => void
): Promise<boolean> {
  if (onStatusChange) {
    onStatusChange('downloading', 'جاري جلب حزمة المشروع المضغوطة من الخادم...');
  }

  const endpoints = [
    '/api/download/project-zip',
    '/xauusd-smc-quant-full-project.zip',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        continue;
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        continue;
      }

      // Method 1: Object URL Download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'xauusd-smc-quant-platform.zip';
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
        onStatusChange('success', 'بدأ تنزيل ملف xauusd-smc-quant-platform.zip بنجاح!');
      }
      return true;
    } catch (err) {
      console.warn(`Failed downloading from ${endpoint}:`, err);
    }
  }

  // Fallback: Open in new tab if programmatic click was blocked by sandbox
  try {
    const newWindow = window.open('/api/download/project-zip', '_blank');
    if (newWindow) {
      if (onStatusChange) {
        onStatusChange('success', 'تم فتح رابط التحميل في علامة تبويب جديدة لتخطي قيود الإطار!');
      }
      return true;
    }
  } catch (e) {}

  if (onStatusChange) {
    onStatusChange('error', 'تعذر التنزيل التلقائي بسبب قيود الأمان في المتصفح. يمكنك نسخ الرابط المباشر أدناه.');
  }
  return false;
}

export function getFullDownloadUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/api/download/project-zip`;
}
