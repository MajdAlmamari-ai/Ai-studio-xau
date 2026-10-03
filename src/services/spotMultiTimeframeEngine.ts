/**
 * @file spotMultiTimeframeEngine.ts
 * @description محرك التحليل الفني متعدد الطبقات للسعر الفوري (Spot XAUUSD).
 * يقيس قوة الرفض السعري ويحدد درجة التوافق الهرمي بين الفريمات دون استخدام الحجم.
 */

// ==========================================
// 1. واجهات البيانات (Interfaces)
// ==========================================

export interface Candle {
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

export type RejectionSide = 'UPPER' | 'LOWER';
export type MarketBias = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface TimeframeAnalysis {
  readonly timeframe: string;
  readonly bias: MarketBias;
  readonly rejectionScore: number;
  readonly isBullish: boolean;
  readonly lastPrice: number;
}

export interface MultiTimeframeAlignmentResult {
  readonly confluenceScore: number; // درجة التوافق (0 إلى 100)
  readonly overallBias: MarketBias;  // الاتجاه العام المرجح
  readonly timeframeDetails: Record<string, TimeframeAnalysis>;
  readonly rationaleAr: string;      // الشرح الفني بالعربية
}

// ==========================================
// 2. دالة قياس قوة الرفض السعري
// ==========================================

/**
 * قياس قوة الرفض السعري (Wick Rejection Score) للذيل العلوي أو السفلي.
 * 
 * @param candle الشمعة المطلوب فحصها
 * @param atr قيمة مؤشر متوسط المدى الحقيقي
 * @param side جهة الرفض ('UPPER' للرفض البيعي من الأعلى، 'LOWER' للرفض الشرائي من الأسفل)
 * @returns درجة الرفض من 0 إلى 100
 */
export function calculatePriceRejection(
  candle: Candle,
  atr: number,
  side: RejectionSide
): number {
  const totalRange = candle.high - candle.low;
  if (totalRange <= 0) return 0;

  const bodyTop = Math.max(candle.open, candle.close);
  const bodyBottom = Math.min(candle.open, candle.close);

  // حساب طول الذيل المستهدف
  const wickSize = side === 'LOWER'
    ? bodyBottom - candle.low
    : candle.high - bodyTop;

  // نسبة الذيل من كامل مدى الشمعة (Wick Ratio)
  const wickRatioPct = (wickSize / totalRange) * 100;

  // التحقق من اتساع الذيل مقارنة بـ ATR لضمان أن الحركة ذات مغزى سعري
  const safeAtr = atr > 0 ? atr : 1.0;
  const atrSignificance = Math.min(1.0, wickSize / safeAtr);

  // النتيجة النهائية: 80% لنسبة الذيل من الشمعة + 20% لتجاوزه تذبذب ATR
  const finalScore = (wickRatioPct * 0.8) + (atrSignificance * 20);

  return Number(Math.min(100, Math.max(0, finalScore)).toFixed(2));
}

// ==========================================
// 3. دالة تحليل الإطار الزمني المفرد
// ==========================================

/**
 * تحليل اتجاه وقوة رفض شمعة فريم محدد.
 */
export function analyzeTimeframe(
  candles: readonly Candle[],
  atr: number,
  timeframeName: string = 'UNKNOWN'
): TimeframeAnalysis {
  if (!candles || candles.length === 0) {
    return {
      timeframe: timeframeName,
      bias: 'NEUTRAL',
      rejectionScore: 0,
      isBullish: false,
      lastPrice: 0,
    };
  }

  const latest = candles[candles.length - 1];
  const isBullish = latest.close >= latest.open;

  const lowerRej = calculatePriceRejection(latest, atr, 'LOWER');
  const upperRej = calculatePriceRejection(latest, atr, 'UPPER');

  let bias: MarketBias = 'NEUTRAL';
  let dominantRejection = 0;

  if (isBullish && lowerRej >= 40) {
    bias = 'LONG';
    dominantRejection = lowerRej;
  } else if (!isBullish && upperRej >= 40) {
    bias = 'SHORT';
    dominantRejection = upperRej;
  } else if (isBullish) {
    bias = 'LONG';
    dominantRejection = lowerRej;
  } else {
    bias = 'SHORT';
    dominantRejection = upperRej;
  }

  return {
    timeframe: timeframeName,
    bias,
    rejectionScore: dominantRejection,
    isBullish,
    lastPrice: latest.close,
  };
}

// ==========================================
// 4. المحرك التراتبي لدمج الفريمات
// ==========================================

/**
 * تقييم التوافق الهرمي الشامل عبر الأطر الزمنية الخمسة.
 * 
 * @param candlesRecord سجل الشموع لكل فريم ('1W', '1D', '4H', '1H', '15m')
 * @param atrRecord سجل قيم ATR المطابقة لكل فريم
 */
export function analyzeMultiTimeframeAlignment(
  candlesRecord: Record<string, readonly Candle[]>,
  atrRecord: Record<string, number>
): MultiTimeframeAlignmentResult {
  // أوزان الفريمات المؤسساتية (المجموع = 100%)
  const timeframeWeights: Record<string, number> = {
    '1W': 0.25,  // الأسبوعي: المستويات الكبرى والاتجاه العام
    '1D': 0.25,  // اليومي: هيكل السوق الرئيسي
    '4H': 0.20,  // 4 ساعات: مناطق العرض والطلب (POI)
    '1H': 0.15,  // الساعة: سحب وتجميع السيولة
    '15m': 0.15, // 15 دقيقة: التأكيد والكسر اللحظي
  };

  const timeframeDetails: Record<string, TimeframeAnalysis> = {};
  let weightedLongScore = 0;
  let weightedShortScore = 0;
  let totalProcessedWeight = 0;

  const monitoredTfs = ['1W', '1D', '4H', '1H', '15m'];

  for (const tf of monitoredTfs) {
    const candles = candlesRecord[tf] || [];
    const atr = atrRecord[tf] || 2.5;
    const weight = timeframeWeights[tf] || 0.2;

    const analysis = analyzeTimeframe(candles, atr, tf);
    timeframeDetails[tf] = analysis;

    if (analysis.bias === 'LONG') {
      weightedLongScore += weight * 100;
    } else if (analysis.bias === 'SHORT') {
      weightedShortScore += weight * 100;
    }

    totalProcessedWeight += weight;
  }

  // تحديد الاتجاه العام ودرجة التوافق
  let overallBias: MarketBias = 'NEUTRAL';
  let confluenceScore = 50;

  if (weightedLongScore > weightedShortScore && weightedLongScore >= 50) {
    overallBias = 'LONG';
    confluenceScore = Number(weightedLongScore.toFixed(2));
  } else if (weightedShortScore > weightedLongScore && weightedShortScore >= 50) {
    overallBias = 'SHORT';
    confluenceScore = Number(weightedShortScore.toFixed(2));
  } else {
    overallBias = 'NEUTRAL';
    confluenceScore = Number(Math.max(weightedLongScore, weightedShortScore).toFixed(2));
  }

  const rationaleAr = overallBias === 'LONG'
    ? `توافق شرائي مؤسساتي بنسبة ${confluenceScore}%. الفريمات الكبرى تدعم الصعود مع رصد رفض سعري داعم.`
    : overallBias === 'SHORT'
    ? `توافق بيعي مؤسساتي بنسبة ${confluenceScore}%. الفريمات الكبرى تؤكد استمرار الضغط البيعي.`
    : `حالة تباين بين الفريمات (توافق ${confluenceScore}%). نوصي بالانتظار لحين وضوح الهيكل.`;

  return {
    confluenceScore,
    overallBias,
    timeframeDetails,
    rationaleAr,
  };
}
