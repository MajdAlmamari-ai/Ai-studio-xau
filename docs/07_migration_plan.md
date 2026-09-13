# خطة الانتقال — Migration Plan

## الهدف

نقل المشروع من الحالة الحالية (بيانات مختلطة مع قيم وهمية)
إلى الحالة المستهدفة (بيانات موثوقة 100%).

## المبادئ الحاكمة

1. NO FAKE DATA EVER — لا بيانات وهمية.
2. ALWAYS SHOW REASON — السبب دائماً مرئي.
3. NO SILENT FALLBACKS — لا fallback صامت.
4. USER DECIDES — المستخدم يقرر.

---

## الفجوات الحالية (6 فجوات)

### الفجوة 1: `generateRealisticGoldCandles` — Math.random

**الموقع:** `src/services/candlesService.ts`

**الخطورة:** 🔴 حرجة

**الوصف:**
دالة تولد شموعاً وهمية عند فشل API باستخدام Math.random().

**الأثر:**
قد تُستخدم في التحليل → نتائج مبنية على وهم.

**الحل:**
- إزالة الدالة نهائياً.
- استبدالها بـ UNAVAILABLE + ReasonDetail.

---

### الفجوة 2: `4468.50` Hardcoded

**الموقع:**
- `src/services/smcEngine.ts`
- `src/hooks/useMarketData.ts`

**الخطورة:** 🔴 حرجة

**الوصف:**
قيمة افتراضية عند غياب السعر.

**الأثر:**
قرارات مبنية على سعر قديم/وهمي.

**الحل:**
- إزالة القيمة.
- إرجاع UNAVAILABLE + ReasonDetail.
- عرض السبب في UI.

---

### الفجوة 3: `2934.50` Hardcoded

**الموقع:** `src/services/candlesService.ts`

**الخطورة:** 🔴 حرجة

**الوصف:**
قيمة افتراضية ثابتة في signature الدالة.

**الأثر:**
شموع وهمية حول سعر خاطئ.

**الحل:**
- إزالة القيمة.
- تغيير signature.

---

### الفجوة 4: PAXG_USDT كـ "Spot XAU/USD"

**الموقع:** `server/gateIoService.ts`

**الخطورة:** 🟠 عالية

**الوصف:**
PAXG token (مدعوم بالذهب) يُعرض كسعر ذهب حقيقي.

**الأثر:**
فرق 5-20 USD عن السعر الحقيقي.

**الحل:**
- استخدام Gold-API للسعر الفوري.
- PAXG = fallback مع وسم `PAXG_APPROX`.

---

### الفجوة 5: CVD من PAXG trades

**الموقع:** `server/gateIoService.ts` → `fetchGateIoSpotTrades`

**الخطورة:** 🟡 متوسطة

**الوصف:**
CVD محسوب من PAXG spot trades.

**الأثر:**
PAXG ≠ XAUUSD order flow.

**الحل:**
- استخدام XAU_USDT futures trades.
- أو candles futures volume.
- توضيح المصدر في UI.

---

### الفجوة 6: لا Scheduler + لا Budget Tracker

**الموقع:** عام.

**الخطورة:** 🟡 متوسطة

**الوصف:**
- لا توقيت محدد للطلبات اليومية/الأسبوعية.
- لا تتبع لاستهلاك المصادر المحدودة.

**الأثر:**
- استهلاك Rate Limit بلا داعٍ.
- احتمال استهلاك الحد بلا وعي.

**الحل:**
- إضافة scheduler.
- إضافة budgetTracker.

---

## خطة الانتقال (6 مراحل)

### المرحلة أ: إزالة البيانات الوهمية

**الخطوات:**

1. حذف `generateRealisticGoldCandles` من `candlesService.ts`.
2. حذف `4468.50` من `smcEngine.ts` و `useMarketData.ts`.
3. حذف `2934.50` من `candlesService.ts`.
4. إضافة ReasonDetail للفشل.

**التحقق:**
- البحث عن `Math.random` في كل ملفات `src/services/`.
- التأكد من عدم وجود أي رقم افتراضي ثابت للأسعار.
- اجتياز اختبارات الفحص `npm run lint`.
- التحقق من معالجة واجهة المستخدم لحالة عدم توفر البيانات (UNAVAILABLE) بشفافية تامة للمتداول.
