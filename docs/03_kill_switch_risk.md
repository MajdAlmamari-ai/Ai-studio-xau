# نظام الحماية والمخاطر — Kill Switch & Risk

## المبدأ الأساسي

المنصة تُوصي. المستخدم يُقرر.

المنصة لا تفعل أي شيء تلقائياً:
- لا تُوقف التداول.
- لا ترسل تحذيرات تلقائية.
- لا تُغلق صفقات.
- لا تُعدّل حجم عقد.

بدلاً من ذلك:
- تحدد الحالة.
- تعرض السبب.
- تعرض التوصية.
- تنتظر قرار المستخدم.

## مستويات الحالة (5 مستويات)

كل قاعدة تُنتج مستوى. المستوى النهائي = أعلى مستوى بين القواعد.

| المستوى | المعنى | التأثير على التوصية |
|---------|--------|---------------------|
| CLEAR | لا مشكلة | توصية عادية |
| CAUTION | تحذير خفيف | توصية مع تنبيه |
| WARNING | تحذير متوسط | توصية مع تخفيض حجم 50% |
| HALT_RECOMMENDED | تحذير قوي | توصية مع تحذير (لا تنفيذ موصى) |
| BLOCKED | لا توصية | BLOCKED |

## القاعدة 1: تقلّب عالٍ (GVZ)

المصدر: CBOE GVZ (تحديث يومي 22:30 UTC).

الشرط:
- GVZ < 20: CLEAR
- 20 ≤ GVZ < 25: CAUTION
- 25 ≤ GVZ < 30: WARNING
- GVZ ≥ 30: HALT_RECOMMENDED

السبب:
- GVZ هو Gold Volatility Index.
- كلما ارتفع، زادت مخاطر التداول.

## القاعدة 2: انفجار ATR

المصدر: Gate.io candles (real-time).

الشرط:
- ATR < 1.5× median: CLEAR
- 1.5× ≤ ATR < 2.5×: CAUTION
- 2.5× ≤ ATR < 4×: WARNING
- ATR ≥ 4× median: HALT_RECOMMENDED

السبب:
- ATR تجاوز المتوسط بشكل كبير.
- انفجار تقلب.

## القاعدة 3: أخبار عالية التأثير

المصدر: FRED, CFTC, economic calendar.

النطاقات:
- -2H إلى -30 min: CAUTION (تخفيض حجم 50%)
- -30 min إلى -5 min: WARNING (انتظار موصى)
- -5 min إلى +5 min: HALT_RECOMMENDED
- +5 min إلى +30 min: WARNING (انتظار تأكيد)
- +30 min وما بعدها: CLEAR

السبب:
- FOMC، NFP، CPI.
- تقلب غير متوقع حول الخبر.

## القاعدة 4: سبريد مرتفع

المصدر: Gold-API bid/ask.

الشرط:
- spread < 1.5× mean: CLEAR
- 1.5× ≤ spread < 2×: CAUTION
- 2× ≤ spread < 3×: WARNING
- spread ≥ 3× mean: HALT_RECOMMENDED

السبب:
- سيولة شحيحة.
- مخاطر slippage عالية.

## القاعدة 5: إغلاق أسبوعي

المصدر: الوقت الحالي (UTC).

الشرط:
- Friday < 19:00: CLEAR
- Friday 19:00-21:00: WARNING
- Friday 21:00-22:00: HALT_RECOMMENDED
- Friday > 22:00: BLOCKED (إغلاق)

السبب:
- إغلاق أسبوعي.
- سيولة منخفضة.
- gap risk عالي.

## القاعدة 6: فشل المصادر

المصدر: Budget Tracker + Fallback Chain.

الشرط:
- كل المصادر تعمل: CLEAR
- 1-2 مصدر فشل: CAUTION
- 3-4 مصدر فشل: WARNING
- كل المصادر فشلت: BLOCKED

السبب:
- لا يمكن التحليل بدون بيانات.

## TypeScript Model

type KillSwitchLevel = 'CLEAR' | 'CAUTION' | 'WARNING' | 'HALT_RECOMMENDED' | 'BLOCKED';

interface KillSwitchRule {
  ruleId: string;
  ruleNameAr: string;
  level: KillSwitchLevel;
  condition: string;
  currentValue: string;
  reason: string;
}

interface KillSwitchResult {
  status: KillSwitchLevel;
  rules: KillSwitchRule[];
  highestLevel: KillSwitchLevel;
  recommendedAction: 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'REDUCE_SIZE' | 'WAIT' | 'BLOCKED';
  userChoices: string[];
  detectedAt: number;
}

## المبدأ الحاكم

- القواعد تُوصي.
- القواعد لا تمنع.
- المستخدم يقرر.
- حتى مع HALT_RECOMMENDED، المستخدم قد ينفذ.

## Position Sizing

المعادلة:
size = (equity × risk_percent) / (stop_distance × contract_value)

مستويات المخاطر:
- Confluence ≥ 80: risk_percent = 1.0%
- Confluence 65-79: risk_percent = 0.5%
- Confluence < 65: لا دخول

تعديل التقلب:
- ATR < median × 0.7: vol_multiplier = 1.25
- ATR ≈ median: vol_multiplier = 1.0
- ATR > median × 1.5: vol_multiplier = 0.5

تعديل Kill Switch:
- CLEAR: vol_multiplier unchanged
- CAUTION: vol_multiplier × 0.8
- WARNING: vol_multiplier × 0.5
- HALT_RECOMMENDED: vol_multiplier × 0.25
- BLOCKED: لا دخول

size_final = size × vol_multiplier

## R:R Calculator

المعادلة:
gross_risk = |entry - stop_loss|
gross_reward = |take_profit - entry|
expected_costs = spread + commission + slippage
net_risk = gross_risk + expected_costs
net_reward = gross_reward - expected_costs
net_rr = net_reward / net_risk

الحد الأدنى:
- A+ Setup: net_rr ≥ 2.5
- A-Setup: net_rr ≥ 2.0
- B-Setup: net_rr ≥ 2.0
- أقل من ذلك: REJECT

## ما تفعله المنصة

- تحسب 6 قواعد Kill Switch.
- تحدد أعلى مستوى.
- تحسب Position Size.
- تحسب Net R:R.
- تعرض الحالة والسبب.
- تعرض الخيارات.

## ما لا تفعله المنصة

- لا تُوقف التداول تلقائياً.
- لا ترسل تحذيرات تلقائية.
- لا تُنشئ أوامر.
- لا تُغلق صفقات.
- لا تُعدّل حجم عقد.

## مخرجات Risk

interface RiskAssessment {
  killSwitch: KillSwitchResult;
  positionSize: {
    recommended: number;
    unit: 'LOTS' | 'OUNCES' | 'USD';
    riskPercent: number;
    volMultiplier: number;
  };
  riskReward: {
    grossRisk: number;
    grossReward: number;
    expectedCosts: number;
    netRisk: number;
    netReward: number;
    netRR: number;
    isValid: boolean;
    minimumRR: number;
  };
  notes: string[];
  assessedAt: number;
}
