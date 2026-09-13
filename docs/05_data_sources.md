# إدارة مصادر البيانات — Data Sources Management

## المبادئ الحاكمة

1. **لا بيانات وهمية** — لا قيم افتراضية عند نقص البيانات. القيمة إما حقيقية أو `null` مع سبب واضح ومعلن.
2. **عرض السبب دائماً** — كل فشل، نقص، تأخير أو استهلاك = سبب مرئي للمستخدم (ماذا حدث، لماذا، وكيف نصلحه).
3. **لا Fallback صامت** — لا "قيمة محايدة" أو "آخر قيمة معروفة" كبديل تلقائي مسكوت عنه.
4. **المستخدم يقرر** — عند النقص الحرج، النظام يعرض الخيارات والشفافية ولا يقرر وحده.

---

## سلسلة المصادر المُعتمدة (Source Priority Chains)

### 1. للأسعار الفورية (Spot XAUUSD)

| الأولوية | المصدر | النوع | الحد والترخيص | الدور وملاحظات التشغيل |
|:---|:---|:---|:---|:---|
| **1** | **Gold-API.com** | REST | غير محدود (حي) | **Primary** — المصدر الأساسي، المفتاح جاهز ومُفعل |
| **2** | **Twelve Data** | REST | 800 طلب/يوم (احتياطي 20%) | Fallback أول عند تعذر الأساسي |
| **3** | **Polygon.io** | REST | 5 طلبات/دقيقة (احتياطي 20%) | Fallback ثانٍ |
| **4** | **Yahoo Finance (XAUUSD=X)** | REST | غير محدود | Fallback طارئ مجاني |

**Endpoint Gold-API الأساسي:**
- `GET https://api.gold-api.com/price/XAU`
- Headers: `x-access-token: <GOLD_API_KEY>`
- الاستجابة: سعر الأونصة الفوري الحقيقي بالدولار، نسبة التغير، وأعلى/أدنى سعر يومي.

---

### 2. لعقود الذهب الآجلة (Futures XAU_USDT & Flow)

| الأولوية | المصدر | النوع | الحد | الدور وملاحظات التشغيل |
|:---|:---|:---|:---|:---|
| **1** | **Gate.io WebSocket** | WS | غير محدود | **Primary** — بث فوري لحظي لأسعار وعقود الذهب الآجلة |
| **2** | **Gate.io REST** | REST | 300 طلب / 10 ثوان | Fallback لعقود الآجل وسجل الصفقات المباشرة |

**البيانات المستخرجة:**
- سعر العقود الآجلة الحية (Futures Mark / Last Price).
- دلتا تدفق الأوامر التراكمي (CVD Delta) وسجل الصفقات المؤسساتية الحية.

---

### 3. للشموع متعددة الأطر الزمنية (Candlesticks MTF)

| الأولوية | المصدر | النوع | الحد | الدور وملاحظات التشغيل |
|:---|:---|:---|:---|:---|
| **1** | **Gate.io REST** | REST | 300 طلب / 10 ثوان | **Primary** — لجميع الأطر الزمنية (M1, M5, M15, H1, H4, D1) |
| **2** | **Stooq** | REST + CSV | غير محدود | Fallback تاريخي يومي ولحظي بدون مفاتيح |
| **3** | **Twelve Data** | REST | 800 طلب/يوم | Fallback إضافي عند الحاجة لأطر محددة |

---

### 4. لسياق عقود كومكس الآجلة (COMEX GC=F Context)

| الأولوية | المصدر | النوع | التحديث | الدور وملاحظات التشغيل |
|:---|:---|:---|:---|:---|
| **1** | **Yahoo Finance (GC=F)** | REST | تأخير 15 دقيقة | **Primary** — لحساب سبريد الذهب الفوري مقابل كومكس والأساس الزمني |
| **2** | **Stooq (GC.F)** | EOD / CSV | نهاية اليوم (EOD) | Fallback للتحليل اليومي التاريخي لبورصة كومكس |

---

### 5. مصادر الماكرو والتقارير الاقتصادية (Macro & Institutional Flow)

- **FRED (Federal Reserve Bank of St. Louis)**: العوائد الحقيقية لسندات الخزانة لأجل 10 سنوات (DFII10).
- **CFTC (Commitments of Traders - COT)**: تقرير التزام كبار المتداولين ومراكز البنوك التجارية الأسبوعي.
- **CBOE (Chicago Board Options Exchange)**: مؤشر تقلبات الذهب الفورية (GVZ Index).
- **SPDR Gold Shares (GLD)**: رصد أطنان الذهب المادية والتدفقات الصافية لصناديق المؤشرات.

---

## سياسة الاحتياطي وإدارة الميزانية (20% Emergency Reserve)

لكل مصدر محدود الاستهلاك (مثل Twelve Data و Polygon و GoldAPI القديم):
1. **الحد الطبيعي اليومي (80%)**: يُستخدم للعمليات الروتينية ومسح السوق.
2. **احتياطي الطوارئ (20%)**: يُحجز ولا يُمس نهائياً في الظروف العادية، ويُفتح فقط في سيناريو الانهيار التام لكافة المصادر الأساسية لتأمين إشارات الخروج والوقف وحماية رؤوس الأموال.
3. **إعادة التعيين التلقائية**:
   - Twelve Data: يتم تصفير العداد عند الساعة 00:00 UTC يومياً.
   - Polygon: يتم تصفير العداد رأس كل دقيقة.

---

## آلية Failover التلقائي (Automatic Failover Architecture)

```typescript
interface SourceAttempt {
  name: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  reason?: string;
  error?: string;
}

interface DataResult<T> {
  status: 'OK' | 'UNAVAILABLE';
  data: T | null;
  source?: string;
  attempts: SourceAttempt[];
  reason?: {
    code: string;
    shortAr: string;
    detailsAr: string;
    howToFix: string[];
    sourcesTried: SourceAttempt[];
    timestamp: number;
  };
}

async function fetchWithFailover<T>(
  dataType: 'SPOT' | 'FUTURES' | 'CANDLES' | 'COMEX' | 'MACRO',
  urgency: 'realtime' | 'normal' | 'batch',
): Promise<DataResult<T>> {
  const chain = selectSources(dataType, urgency);
  const attempts: SourceAttempt[] = [];

  for (const source of chain) {
    const status = budgetTracker.getStatus(source.name);

    // فحص استنفاد الحصة أو الوصول للاحتياطي
    if (status.budgetExhausted || (status.inReserve && urgency !== 'realtime')) {
      attempts.push({
        name: source.name,
        status: 'SKIPPED',
        reason: `BUDGET_LIMIT (${status.used}/${status.limit}, reset in ${status.resetInMs}ms)`,
      });
      continue;
    }

    if (status.rateLimited) {
      attempts.push({
        name: source.name,
        status: 'SKIPPED',
        reason: 'RATE_LIMITED',
      });
      continue;
    }

    try {
      const data = await source.fetch(dataType);
      budgetTracker.record(source.name, 1);
      attempts.push({ name: source.name, status: 'SUCCESS' });

      return {
        status: 'OK',
        data,
        source: source.name,
        attempts,
      };
    } catch (err: any) {
      attempts.push({
        name: source.name,
        status: 'FAILED',
        error: err?.message || 'Network error',
      });
      continue; // انتقال تلقائي وسلس للمصدر البديل
    }
  }

  // في حال تعذر جميع المصادر، لا نطلق بيانات وهمية، بل تقريراً شفافاً
  return {
    status: 'UNAVAILABLE',
    data: null,
    attempts,
    reason: {
      code: 'ALL_SOURCES_EXHAUSTED',
      shortAr: 'استُهلكت جميع المصادر أو تعذر الاتصال بها',
      detailsAr: formatExhaustionReport(attempts),
      howToFix: [
        '1. الانتظار حتى تجدد الحصص اللحظية تلقائياً',
        '2. التحقق من الاتصال بالإنترنت ومفاتيح API في الإعدادات',
        '3. رفع ملف CSV تاريخي للاستمرار في التحليل دون توقف',
      ],
      sourcesTried: attempts,
      timestamp: Date.now(),
    },
  };
}
```

---

## واجهة حالة المصادر (/api/data/sources/status)

توفر المنصة نقطة نهاية برمجية وواجهة مراقبة مرئية تعرض:
- اسم كل مصدر وحالته اللحظية (ONLINE / RATE_LIMITED / EXHAUSTED / ERROR).
- نسبة استهلاك الحصة والطلبات المتبقية وموعد التجديد.
- ما إذا كان المصدر يعمل بالوضع الطبيعي أم بالاحتياطي (20% Reserve).
- خيار التبديل اليدوي وإعادة ضبط العدادات للمشرف.
