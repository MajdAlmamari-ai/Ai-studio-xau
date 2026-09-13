# مصفوفة التقييم الكمي Score Matrix v2.1

## نظرة عامة

مصفوفة التقييم هي جوهر محرك التحليل المؤسسي (Institutional Quant Engine).
تجمع 8 مكونات كمية متقدمة في درجة توافق إجمالية نهائية تتراوح من 0 إلى 100%.

## المبادئ الحاكمة

1. **لا بيانات وهمية (NO FAKE DATA EVER)** — لا قيم افتراضية عند نقص بيانات أي مؤشر أو إطار زمني. المكون يكون إما حاسوبياً بدقة أو `null` مع كود سبب صريح.
2. **عرض السبب دائماً (ALWAYS SHOW REASON)** — كل مكون غير متاح يُظهر سببه التقني للمتداول (مثل: نقص الشموع المكتملة، انقطاع الاتصال، إلخ).
3. **لا Fallback صامت (NO SILENT FALLBACKS)** — يُحظر استخدام "قيمة محايدة 0.5" أو افتراض توازن وهمي عند غياب البيانات.
4. **المستخدم يقرر (USER DECIDES)** — عند نقص أي مكون، يُعلن النظام النقص بشفافية ويترك للمتداول خيار المتابعة بحذر أو انتظار اكتمال البيانات.

---

## جدول المكونات الثمانية والأوزان المعتمدة

| # | المكون الكمي (Component) | الوزن النسبي | إطار البيانات | الدور المؤسساتي |
|---|:---|:---:|:---:|:---|
| **1** | **HTF Market Structure** | **25%** | W1 / D1 / H4 | توافق الهيكل الكلي والاتجاه الرئيسي |
| **2** | **Liquidity Sweep Confirmed** | **20%** | H4 / H1 / M15 | تأكيد سحب السيولة واقتناص الذيول |
| **3** | **Order Flow Approximation** | **20%** | Futures XAU_USDT | دلتا تدفق الأوامر التراكمي (CVD Delta) |
| **4** | **Value Area Alignment** | **10%** | H1 / D1 Volume Profile | موقع السعر مقارنة بـ POC و VAH و VAL |
| **5** | **Real Yield & DXY** | **10%** | FRED (DFII10) & DXY | العوائد الحقيقية للسندات ومؤشر الدولار |
| **6** | **Basis Z-Score** | **5%** | COMEX vs Spot | معيار انحراف سبريد الفوري مقابل الآجل |
| **7** | **Volatility Regime** | **5%** | ATR & CBOE GVZ | فحص بيئة التقلب وانضغاط الزنبرك |
| **8** | **Session Alignment** | **5%** | London / NY Overlap | توقيت جلسات السيولة المؤسساتية العالية |
| **المجموع** | **8 مكونات متكاملة** | **100%** | — | **الدرجة الإجمالية (0 - 100)** |

---

## تفصيل المكونات الثمانية ومعادلاتها الرياضية

### المكون 1: HTF Market Structure (25%)

**الوصف:**
توافق الهيكل عبر الأطر العالية (W1, D1, H4) لضمان عدم التداول عكس الاتجاه المؤسساتي السائد.

**المعادلة:**
```typescript
score_structure =
    0.30 × W1_bias_alignment +
    0.40 × D1_structure_alignment +
    0.30 × H4_structure_alignment;

// كل alignment = 1 إذا متوافق مع اتجاه الصفقة المقترحة، و 0 إذا غير متوافق
// score_structure ∈ [0, 1]
```

---

### المكون 2: Liquidity Sweep Confirmed (20%)

**الوصف:**
رصد اقتناص السيولة (Stop-Hunt) عبر اختراق قمة أو قاع شمعة سابقة والإغلاق السريع داخل النطاق، أو سحب قاع/قمة شمعة الأخبار القوية (قاعدة الـ 15 دقيقة).

**المعادلة:**
```typescript
// فحص سحب السيولة على فريمات H4 و H1 وتأكيد M15
score_sweep = 
    (hasH4Sweep ? 0.50 : 0.0) +
    (hasH1Sweep ? 0.30 : 0.0) +
    (hasM15ChochConfirmation ? 0.20 : 0.0);

// score_sweep ∈ [0, 1]
```

---

### المكون 3: Order Flow & CVD Delta (20%)

**الوصف:**
تحليل دلتا تدفق الأوامر التراكمي (Cumulative Volume Delta) ونسبة عدم توازن الشراء والبيع (Imbalance Ratio) من عقود الذهب الآجلة على Gate.io.

**المعادلة:**
```typescript
// إذا كانت الصفقة شراء (BUY):
// CVD متزايد مع تباعد صاعد = 1.0، محايد = 0.5، متباعد هابط = 0.0
score_orderflow = normalizeCVDAlignment(cvdTrend, tradeDirection, volumeImbalanceRatio);
// score_orderflow ∈ [0, 1]
```

---

### المكون 4: Value Area Alignment (10%)

**الوصف:**
موقع السعر بالنسبة لمناطق القيمة العادلة لملف الحجم (Volume Profile: POC, VAH, VAL):
- الشراء المؤسساتي يفضل منطقة الخصم (Discount Zone) أو الارتداد من VAL / POC الصاعد.
- البيع المؤسساتي يفضل منطقة العلاوة (Premium Zone) أو الارتداد من VAH / POC الهابط.

**المعادلة:**
```typescript
score_value_area = calculateValueAreaFit(currentPrice, POC, VAH, VAL, tradeDirection);
// score_value_area ∈ [0, 1]
```

---

### المكون 5: Real Yield & DXY (10%)

**الوصف:**
الارتباط المالي الكلي المعاكس للذهب مع العوائد الحقيقية لسندات الخزانة الأمريكية لأجل 10 سنوات (FRED: DFII10) ومؤشر الدولار الأمريكي (DXY):
- هبوط العوائد الحقيقية والدولار يدعم صعود الذهب (+).
- ارتفاع العوائد الحقيقية وقوة الدولار يضغطان على الذهب هبوطاً (-).

**المعادلة:**
```typescript
score_macro = 0.60 × realYieldDirectionFit + 0.40 × dxyTrendFit;
// score_macro ∈ [0, 1]
```

---

### المكون 6: Basis Z-Score (5%)

**الوصف:**
قياس الانحراف المعياري (Z-Score) للفارق السعري بين عقود شيكاغو الآجلة والسعر الفوري (Basis Spread). الانحرافات القصوى تكشف صدمات السيولة أو فرص الارتداد العنيف.

**المعادلة:**
```typescript
basisSpread = futuresPrice - spotPrice;
basisZScore = (basisSpread - meanBasis20D) / stdBasis20D;

score_basis = calculateBasisZScoreFit(basisZScore, tradeDirection);
// score_basis ∈ [0, 1]
```

---

### المكون 7: Volatility Regime & Compression (5%)

**الوصف:**
فحص نظام التقلب باستخدام مؤشر CBOE Gold Volatility (GVZ) ومقارنة ATR(14) اللحظي بنطاق آخر 20 شمعة لكشف انضغاط الزنبرك (Spring Coil Compression).

**المعادلة:**
```typescript
// يمنح الدرجة الكاملة عند انتهاء الانضغاط وبدء الانفجار السعري المؤسساتي
score_volatility = calculateVolatilityFit(isCompressed, gvzRegime, atrExpansion);
// score_volatility ∈ [0, 1]
```

---

### المكون 8: Session Alignment (5%)

**الوصف:**
توافق توقيت الإشارة مع جلسات التداول ذات السيولة البنكية القصوى (جلسة لندن، جلسة نيويورك، وتداخل لندن/نيويورك Golden Overlap).

**المعادلة:**
```typescript
score_session = isLondonNYOverlap ? 1.0 :
                (isLondonOpen || isNYOpen) ? 0.8 :
                isAsianSession ? 0.3 : 0.0;
// score_session ∈ [0, 1]
```

---

## معادلة الدرجة الإجمالية (Total Composite Score)

$$\text{Total Score} = \sum_{i=1}^{8} \left( \text{Weight}_i \times \text{Component Score}_i \right) \times 100$$

```typescript
const TOTAL_SCORE = (
  (score_structure * 0.25) +
  (score_sweep * 0.20) +
  (score_orderflow * 0.20) +
  (score_value_area * 0.10) +
  (score_macro * 0.10) +
  (score_basis * 0.05) +
  (score_volatility * 0.05) +
  (score_session * 0.05)
) * 100;
```

---

## التصنيف

| النطاق | التصنيف | R:R المطلوب | التوصية |
|--------|---------|-------------|---------|
| ≥ 80 | **A+ Setup** | ≥ 1:2.5 | توصية قوية جداً |
| 70-79 | **A-Setup** | ≥ 1:2.0 | توصية مؤكدة |
| 65-69 | **B-Setup** | ≥ 1:2.0 | توصية متوسطة |
| 60-64 | **WAIT** | — | انتظار (عرض فقط) |
| < 60 | **REJECT** | — | لا توصية |
| **بيانات حرجة ناقصة** | **BLOCKED** | — | غير متاح |

### ما تفعله المنصة:

- ✅ تحسب التصنيف.
- ✅ تعرض التوصية.
- ✅ تعرض الأسباب.
- ✅ تعرض R:R.
- ❌ لا ترسل تلقائياً.
- ❌ لا تنفذ تلقائياً.
- ❌ لا تعدل حجم الصفقة.
- ❌ لا تُنشئ أوامر.

### ما يفعله المستخدم:

- يقرأ التوصية.
- يقرر.
- ينفذ يدوياً (إن أراد).

---

## سياسة معالجة البيانات الناقصة (Missing Component Policy)

إذا كان أحد المكونات الـ 8 غير متاح (مثلاً تعذر جلب DFII10 أو صيانة مؤقتة لـ Gate.io):
1. **لا استبدال بقيمة افتراضية أو عشوائية مطلقاً.**
2. يُسجل المكون بحالة `status: 'UNAVAILABLE'` مع `reason`.
3. يتم إشعار المستخدم بنقص المكون وتصنيف الحالة كـ `BLOCKED` إذا كان المكون الناقص حرجاً (مثل HTF Structure أو Sweeps) مع إيقاف تقديم التوصية.

---

## نموذج التوصية — Recommendation Format

### 3 سيناريوهات لكل توصية

كل تحليل يُنتج 3 سيناريوهات، وليس توصية واحدة.

**القاعدة:**
P(primary) + P(alternative) + P(invalidation) = 100%

### 1. السيناريو الأساسي (Primary)

**يُبنى على:**
- الاتجاه من HTF Structure (W1 + D1 + H4).
- الدخول من H4 OB أو FVG.
- SL من آخر swing.
- TP من Liquidity Pool.
- الاحتمالية: 55-75%.

### 2. السيناريو البديل (Alternative)

**يُبنى على:**
- إذا فشل الاختراق المباشر.
- انتظار Pullback إلى FVG أو OB.
- دخول أفضل من الأساسي.
- R:R أفضل.
- الاحتمالية: 15-35%.

**شرط التنشيط:**
مثال: "إذا لم يخترق السعر 4365 مباشرة،
انتظر Pullback إلى 4352."

### 3. سيناريو الإبطال (Invalidation)

**يُبنى على:**
- مستوى الإبطال: آخر swing + ATR buffer.
- شروط الإبطال:
  - إغلاق شمعة 15M تحت/فوق المستوى.
  - Real Yield تحرك > 15bps عكس الاتجاه.
  - مرور 6 ساعات بدون TP1.
- الاحتمالية: 5-15%.

### ما تفعله المنصة

- ✅ تحسب 3 سيناريوهات.
- ✅ تعرضها بوضوح.
- ✅ تعرض الأسباب.

### ما لا تفعله المنصة

- ❌ لا تنفذ أي سيناريو تلقائياً.
- ❌ لا ترسل Telegram.
- ❌ لا تُنشئ أوامر.
- ❌ لا تعدل الصفقات.

---

### TypeScript Model — Scenario

```typescript
type ScenarioType = 'PRIMARY' | 'ALTERNATIVE' | 'INVALIDATION';

interface Scenario {
  type: ScenarioType;
  titleAr: string;
  probability: number;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  action: 'BUY' | 'SELL' | 'WAIT';
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfit3: number | null;
  riskReward: number | null;
  riskRewardRatio: string | null;
  confidence: number;
  confidenceLabel: string;
  reasons: Array<{
    component: string;
    status: 'PASS' | 'FAIL' | 'UNAVAILABLE';
    detail: string;
  }>;
  activationCondition: string | null;
  invalidationConditions: string[];
  notesAr: string[];
}
```

---

### TypeScript Model — Recommendation

```typescript
interface Recommendation {
  primary: Scenario;
  alternative: Scenario;
  invalidation: Scenario;
  currentPrice: number;
  atr: number | null;
  score: number | null;
  classification: 'A+ Setup' | 'A-Setup' | 'B-Setup' |
                   'WAIT' | 'REJECT' | 'BLOCKED';
  spotSource: string;
  futuresSource: string;
  recommendedAt: number;
  expiresAt: number;
  disclaimer: string;
}
```

---

### مثال كامل

📊 تحليل XAUUSD — 3 سيناريوهات
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 السيناريو الأساسي (Primary) — 65%
   العملية: BUY
   الدخول: 4358.12
   SL: 4352.50
   TP1: 4365.00 (R:R 1:1.25)
   TP2: 4372.50 (R:R 1:2.50)
   الثقة: عالية (78/100)

🔄 السيناريو البديل (Alternative) — 25%
   العملية: BUY بعد Pullback
   الدخول: 4352.00
   SL: 4346.50
   TP1: 4360.00 (R:R 1:1.45)
   TP2: 4368.00 (R:R 1:2.90)
   الثقة: متوسطة (65/100)

   شرط التنشيط:
     إذا لم يخترق السعر 4365 مباشرة،
     انتظر Pullback إلى FVG عند 4352.

❌ سيناريو الإبطال (Invalidation) — 10%
   الإبطال عند: إغلاق 15M < 4350.00
   السبب: كسر الهيكل الصاعد
   الإجراء: WAIT + إعادة التحليل

   شروط الإبطال:
     1. إغلاق 15M تحت 4350
     2. Real Yield تحرك > 15bps
     3. مرور 6 ساعات بدون TP1



