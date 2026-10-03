/**
 * @file basisSyncGuardService.ts
 * @description خدمة حماية ومزامنة الفارق السعري (Basis Spread) بين السعر الفوري للذهب والعقود الآجلة.
 * تضمن استمرار عمل محرك السبوت بسلاسة عند انقطاع تغذية الفيوتشرز وتمنع القفزات السعرية الوهمية.
 */

export interface BasisGuardMetrics {
  readonly effectiveBasis: number;
  readonly isFuturesLive: boolean;
  readonly healthState: 'HEALTHY_SYNCED' | 'DEGRADED_FALLBACK' | 'DEFAULT_BASELINE';
  readonly healthMessageAr: string;
  readonly cautionMode: boolean;
  readonly positionSizeMultiplier: number;
  readonly divergencePct: number;
}

// الحالة الداخلية الآمنة (Last Known Valid Basis) مع قيمة أساسية افتراضية 8.40$
let lastKnownValidBasis: number = 8.40;
let lastSyncTimestamp: number = Date.now();

/**
 * يعيد آخر فارق سعري مسجل أو القيمة الافتراضية
 */
export function getLastKnownValidBasis(): number {
  return lastKnownValidBasis;
}

/**
 * دالة مساعدة لإعادة تعيين الحالة (مفيدة للاختبارات)
 */
export function resetBasisGuardState(basis: number = 8.40): void {
  lastKnownValidBasis = basis;
  lastSyncTimestamp = Date.now();
}

/**
 * يحسب الفارق السعري (Basis) ويقيم صحة الاتصال مع منع انقطاع السبوت أو القفزات المفاجئة.
 */
export function resolveBasisAndSyncHealth(
  spotPrice: number,
  futuresPrice: number | null | undefined
): BasisGuardMetrics {
  const isFuturesLive = typeof futuresPrice === 'number' && futuresPrice > 0;
  let effectiveBasis = lastKnownValidBasis;
  let healthState: BasisGuardMetrics['healthState'] = 'DEFAULT_BASELINE';
  let healthMessageAr = '';
  let divergencePct = 0;

  if (isFuturesLive) {
    const rawBasis = futuresPrice - spotPrice;
    const expectedFuturesPrice = spotPrice + lastKnownValidBasis;
    const absoluteDivergence = Math.abs(futuresPrice - expectedFuturesPrice) / spotPrice * 100;
    divergencePct = Number(absoluteDivergence.toFixed(3));
    
    // التحقق من صحة الفارق (منطقياً ضمن نطاق مقبول للذهب بين -$10 و +$50)
    if (rawBasis >= -10 && rawBasis <= 50) {
      lastKnownValidBasis = Number(rawBasis.toFixed(2));
      lastSyncTimestamp = Date.now();
      effectiveBasis = lastKnownValidBasis;
      healthState = 'HEALTHY_SYNCED';
      healthMessageAr = `مزامنة نشطة مع العقود الآجلة (COMEX GC). الفارق اللحظي: $${effectiveBasis.toFixed(2)}`;
    } else {
      effectiveBasis = lastKnownValidBasis;
      healthState = 'DEGRADED_FALLBACK';
      healthMessageAr = `⚠️ فارق غير طبيعي ($${rawBasis.toFixed(2)}); تم الحفاظ على آخر فارق سليم ($${effectiveBasis.toFixed(2)})`;
    }
  } else {
    // انقطاع تغذية الفيوتشرز -> Fallback آمن
    effectiveBasis = lastKnownValidBasis;
    healthState = 'DEGRADED_FALLBACK';
    healthMessageAr = `⚠️ انقطاع مؤقت في تغذية العقود الآجلة؛ تم استخدام آخر فارق سعري مسجل ($${effectiveBasis.toFixed(2)}) لضمان استمرارية السبوت.`;
  }

  const cautionMode = divergencePct > 0.3;
  const positionSizeMultiplier = cautionMode ? 0.5 : 1.0;

  if (cautionMode) {
    healthMessageAr += ` | 🛡️ وضع الحذر مفعل (تباين ${divergencePct}% > 0.3%): تخفيض حجم اللوت إلى 50%.`;
  }

  return {
    effectiveBasis,
    isFuturesLive,
    healthState,
    healthMessageAr,
    cautionMode,
    positionSizeMultiplier,
    divergencePct,
  };
}
