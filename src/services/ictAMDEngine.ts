/**
 * @file ictAMDEngine.ts
 * @description محرك خوارزميات توقيت السيولة ونموذج AMD (التجميع والتلاعب والتوزيع).
 * يعتمد على توقيت نيويورك الصارم لرصد فخاخ السيولة (Judas Swing) لسعر الذهب الفوري.
 */

// ==========================================
// 1. واجهات البيانات (Interfaces)
// ==========================================

export interface Candle {
  readonly time: number; // UTC timestamp بالثواني
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

export interface AsianRange {
  readonly isValid: boolean;
  readonly high: number;
  readonly low: number;
}

export type AmdPhase = 'ACCUMULATION' | 'MANIPULATION_SWEEP' | 'DISTRIBUTION' | 'NONE';
export type SweepDirection = 'HIGH' | 'LOW' | 'NONE';

export interface AmdResult {
  readonly phase: AmdPhase;
  readonly sweepDirection: SweepDirection;
  readonly isSweep: boolean;
  readonly rationaleAr: string;
}

// ==========================================
// 2. الدوال التنفيذية
// ==========================================

/**
 * تحويل طابع UTC بالثواني إلى ساعة نيويورك المحلية (0 - 23).
 * يعالج التوقيت الصيفي والشتوي تلقائياً عبر Intl API.
 * 
 * @param utcSeconds الوقت بصيغة Unix Timestamp بالثواني
 * @returns ساعة نيويورك كرقم صحيح بين 0 و 23
 */
export function getNewYorkHour(utcSeconds: number): number {
  const date = new Date(utcSeconds * 1000);

  // استخدام منسق التواريخ الأصلي لربط منطقة نيويورك بأمان
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hourCycle: 'h23', // يضمن نطاق الساعات من 0 إلى 23
  });

  return parseInt(formatter.format(date), 10);
}

/**
 * رصد وتحديد نطاق التجميع الآسيوي (Asian Range).
 * يستخرج أعلى وأدنى سعر للشموع المتداولة بين الساعة 20:00 و 00:00 بتوقيت نيويورك.
 * 
 * @param candles مصفوفة شموع التداول
 * @returns كائن يحتوي على حدود النطاق وحالة صلاحيته
 */
export function detectAsianRange(candles: readonly Candle[]): AsianRange {
  let maxHigh = -Infinity;
  let minLow = Infinity;
  let matchingCandlesCount = 0;

  for (const candle of candles) {
    const nyHour = getNewYorkHour(candle.time);

    // الساعات التابعة لجلسة آسيا (20:00، 21:00، 22:00، 23:00)
    if (nyHour >= 20 && nyHour < 24) {
      if (candle.high > maxHigh) maxHigh = candle.high;
      if (candle.low < minLow) minLow = candle.low;
      matchingCandlesCount++;
    }
  }

  // إذا لم تتواجد شموع تقع داخل الجلسة
  if (matchingCandlesCount === 0) {
    return {
      isValid: false,
      high: 0,
      low: 0,
    };
  }

  return {
    isValid: true,
    high: Number(maxHigh.toFixed(2)),
    low: Number(minLow.toFixed(2)),
  };
}

/**
 * اكتشاف حركة التلاعب بضرب السيولة (Judas Swing) ومرحلة نموذج AMD.
 * 
 * @param currentCandle شمعة الاختبار اللحظية
 * @param asianRange نطاق آسيا المحسوب مسبقاً
 * @returns حالة مرحلة الـ AMD واتجاه السحب
 */
export function detectJudasSwingAMD(
  currentCandle: Candle,
  asianRange: AsianRange
): AmdResult {
  // التحقق من صلاحية نطاق آسيا المرجعي
  if (!asianRange || !asianRange.isValid) {
    return {
      phase: 'NONE',
      sweepDirection: 'NONE',
      isSweep: false,
      rationaleAr: 'نطاق آسيا غير مكتمل أو غير صالح للمقارنة.',
    };
  }

  const sweptHigh = currentCandle.high > asianRange.high;
  const sweptLow = currentCandle.low < asianRange.low;

  // 1. تلاعب علوي: اختراق قمة آسيا لسحب سيولة الشراء (Buy-Side Liquidity)
  if (sweptHigh) {
    return {
      phase: 'MANIPULATION_SWEEP',
      sweepDirection: 'HIGH',
      isSweep: true,
      rationaleAr: `تم اختراق قمة آسيا ($${asianRange.high}) وصولاً إلى $${currentCandle.high}؛ رصد فخ سيولة بيعي (Judas Swing).`,
    };
  }

  // 2. تلاعب سفلي: كسر قاع آسيا لسحب سيولة البيع (Sell-Side Liquidity)
  if (sweptLow) {
    return {
      phase: 'MANIPULATION_SWEEP',
      sweepDirection: 'LOW',
      isSweep: true,
      rationaleAr: `تم كسر قاع آسيا ($${asianRange.low}) وصولاً إلى $${currentCandle.low}؛ رصد فخ سيولة شرائي (Judas Swing).`,
    };
  }

  // 3. في حال كان السعر لا يزال داخل النطاق
  return {
    phase: 'ACCUMULATION',
    sweepDirection: 'NONE',
    isSweep: false,
    rationaleAr: 'السعر يتداول داخل حدود نطاق آسيا دون أي كسر تلاعبي.',
  };
}
