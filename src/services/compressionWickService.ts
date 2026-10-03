/**
 * @file compressionWickService.ts
 * @description خدمة تنقية الذيول وتحديد نضارة مناطق التداول.
 * هذا الملف يحتوي على الدوال النقية (Pure Functions) المطلوبة لاجتياز الاختبارات.
 */

// ==========================================
// 1. تعريف واجهات البيانات (Interfaces)
// ==========================================

export interface WickValidationResult {
  isUpperWickValid: boolean;
  isLowerWickValid: boolean;
  upperWickSize: number;
  lowerWickSize: number;
  maxAllowedWick: number;
}

export interface ZoneFreshnessResult {
  zoneId: string;
  touches: number;
  freshnessScore: number;
  isConsumed: boolean;
}

// ==========================================
// 2. الدوال الرئيسية (Functions)
// ==========================================

/**
 * دالة `purifyCandleWick`:
 * تقوم بحساب حجم ذيول الشمعة وتتأكد من أنها لا تتجاوز سقف التذبذب الديناميكي.
 * 
 * @param open سعر الافتتاح
 * @param high أعلى سعر وصلت له الشمعة
 * @param low أدنى سعر وصلت له الشمعة
 * @param close سعر الإغلاق
 * @param atr متوسط المدى الحقيقي (لحساب الحد الأقصى للذيل)
 * @returns كائن يحتوي على نتيجة فحص الذيل العلوي والسفلي
 */
export function purifyCandleWick(
  open: number,
  high: number,
  low: number,
  close: number,
  atr: number
): WickValidationResult {
  // الخطوة 1: حساب الحد الأقصى المسموح به للذيل (مضاعف 2.0 من قيمة ATR)
  const maxAllowedWick = atr * 2.0;

  // الخطوة 2: تحديد أعلى نقطة وأدنى نقطة لجسم الشمعة (Body)
  const bodyTop = Math.max(open, close);
  const bodyBottom = Math.min(open, close);

  // الخطوة 3: حساب مسافة الذيل العلوي والسفلي
  const upperWickSize = high - bodyTop;
  const lowerWickSize = bodyBottom - low;

  // الخطوة 4: تقييم صحة الذيول (يجب أن يكون حجم الذيل أصغر من أو يساوي الحد الأقصى)
  const isUpperWickValid = upperWickSize <= maxAllowedWick;
  const isLowerWickValid = lowerWickSize <= maxAllowedWick;

  return {
    isUpperWickValid,
    isLowerWickValid,
    upperWickSize,
    lowerWickSize,
    maxAllowedWick,
  };
}

/**
 * دالة `calculateZoneTouchFreshness`:
 * تحسب درجة نضارة منطقة التداول بناءً على نموذج "اللمس والاستهلاك".
 * 
 * @param zoneId المعرف النصي للمنطقة (مثل: 'zone-1')
 * @param touches عدد مرات ملامسة السعر لهذه المنطقة
 * @returns كائن يحتوي على درجة النضارة (0 إلى 100) وحالة الاستهلاك
 */
export function calculateZoneTouchFreshness(
  zoneId: string,
  touches: number
): ZoneFreshnessResult {
  let freshnessScore = 100;
  let isConsumed = false;

  // تطبيق المنطق الرياضي حسب عدد اللمسات
  if (touches === 0) {
    freshnessScore = 100; // منطقة جديدة (Super Fresh)
    isConsumed = false;
  } else if (touches === 1) {
    freshnessScore = 50;  // تم اختبارها مرة واحدة (Tested)
    isConsumed = false;
  } else {
    freshnessScore = 0;   // لمستان أو أكثر تعني استهلاك المنطقة (Mitigated)
    isConsumed = true;
  }

  return {
    zoneId,
    touches,
    freshnessScore,
    isConsumed,
  };
}
