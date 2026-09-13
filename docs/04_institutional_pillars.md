# الركائز المؤسساتية — Institutional Pillars

## نظرة عامة

5 ركائز تُعزز التحليل الكمي:
1. CME GC Futures + CVD Delta
2. Post-News Liquidity Sweep
3. Compression + Wick Filter + Freshness
4. Real-Time Proximity Scanner
5. Post-Trade Memory & Journal

كل ركيزة لها دور محدد. لا تكرار.

## الركيزة 1: CME GC Futures + CVD Delta

### الهدف

قياس تدفق الأوامر الحقيقي من العقود الآجلة.

### المصادر

- Gate.io futures XAU_USDT (real-time).
- Yahoo GC=F (COMEX reference).

### المعادلات

Delta:
delta_t = ask_volume_t - bid_volume_t

CVD:
CVD_t = cumulative_sum(delta)

FI:
FI = (bid_volume - ask_volume) / (bid_volume + ask_volume)

### التفسير

- CVD صاعد + سعر صاعد: تأكيد.
- CVD نازل + سعر صاعد: divergence (تحذير).
- CVD صاعد + سعر نازل: divergence (فرصة محتملة).

### التكامل مع Score Matrix

المكون 3 (Order Flow): 20%.

### القيد

- لا Footprint حقيقي (تقريب).
- لا Time & Sales.
- Approximation فقط.

## الركيزة 2: Post-News Liquidity Sweep

### الهدف

كشف انعكاسات ما بعد الأخبار الكبيرة.

### المصادر

- FRED, CFTC (أوقات الأخبار).
- Gate.io candles (للكشف).

### المعادلة

الشرط:
- حدث HIGH impact انتهى خلال 5-30 دقيقة.

الكشف:
- wick الشمعة الحالية > wick شمعة الخبر.
- close يعود داخل نطاق شمعة الخبر.

الإشارة:
- Bullish Reversal إذا sweep لأسفل.
- Bearish Reversal إذا sweep لأعلى.

### التكامل

- ليس مكوناً في Score Matrix.
- يظهر كـ context في Decision.
- يعزز الثقة إذا توافق مع Primary.

### القيد

- يحتاج بيانات أخبار حقيقية.
- إذا NEWS_DATA_UNAVAILABLE: لا يُطبَّق.

## الركيزة 3: Compression + Wick Filter + Freshness

### الهدف

كشف انضغاط السعر + حماية وقف الخسارة + قياس عمر المنطقة.

### المصادر

- Gate.io candles (ATR).
- Order Blocks (freshness).

### المعادلات

Compression:
springCoilRatio = current_ATR / lowest_ATR_20
isCompressed = springCoilRatio < 1.15

Wick Buffer:
wickBuffer = max_wick_10 + 1.5 × ATR

Freshness:
- age ≤ 5 bars: score = 100
- 5 < age < 20: linear 100 → 0
- age ≥ 20: score = 0
- Tested penalty: -15
- Breached penalty: -70

### التكامل

المكون 7 (Volatility Regime): 5%.
يُستخدم أيضاً في SL calculation.

## الركيزة 4: Real-Time Proximity Scanner

### الهدف

تنبيه عندما يقترب السعر من منطقة مهمة.

### المصادر

- FVGs (real engine).
- Order Blocks (real engine).
- Liquidity Levels.

### المعادلة

المسافة:
distance = |current_price - zone_center|

المستويات:
- WATCH: distance ≤ 3.0 USD
- READY: distance ≤ 1.5 USD
- AT_ZONE: distance ≤ 0.5 USD

### التكامل

- ليس مكوناً في Score Matrix.
- يُعرض في UI.
- تنبيهات (اختيارية).
- لا تنفيذ تلقائي.

## الركيزة 5: Post-Trade Memory & Journal

### الهدف

تسجيل الصفقات لأغراض المعايرة.

### المصادر

- كل قرار.
- كل صفقة (إذا نفذها المستخدم).

### السجلات

TradeJournalEntry:
- decisionId
- entry, exit, SL, TP
- realizedR
- MAE, MFE
- newsStatusAtEntry
- regimeAtEntry
- sessionAtEntry
- zoneType
- mitmitgationCountAtEntry

### التكامل

- يُستخدم في Calibration.
- لا يؤثر على القرار الحالي.
- تحليل أداء حسب regime, session, zoneType.

## جدول التكامل

| الركيزة | في Score Matrix | في UI | في Decision |
|---------|----------------|-------|-------------|
| 1. CME + CVD | ✅ مكون 3 | ✅ | ✅ |
| 2. Post-News Sweep | ❌ | ✅ | ✅ context |
| 3. Compression | ✅ مكون 7 | ✅ | ✅ |
| 4. Proximity | ❌ | ✅ | ❌ |
| 5. Trade Journal | ❌ | ✅ | ❌ (calibration only) |

## المبادئ الحاكمة

- الركائز تُعزز التحليل.
- لا تُنفذ أي شيء تلقائياً.
- تُعرض للمستخدم.
- المستخدم يقرر.

## TypeScript Model

interface InstitutionalPillars {
  cmeCvd: {
    cvd: number;
    fi: number;
    deltaBias: 'STRONG_BUYERS' | 'STRONG_SELLERS' | 'NEUTRAL';
    divergence: 'BULLISH' | 'BEARISH' | 'NONE';
  } | null;
  postNewsSweep: {
    active: boolean;
    type: 'BULLISH_REVERSAL' | 'BEARISH_REVERSAL' | 'NONE';
    newsEventId: string | null;
    minutesAfterEvent: number | null;
  } | null;
  compression: {
    isCompressed: boolean;
    springCoilRatio: number | null;
    wickBuffer: number | null;
  } | null;
  proximity: {
    nearestZone: {
      type: 'FVG' | 'OB' | 'LIQUIDITY';
      price: number;
      distance: number;
      level: 'WATCH' | 'READY' | 'AT_ZONE';
    } | null;
  } | null;
}

## ما تفعله المنصة

- تحسب كل ركيزة.
- تعرضها في UI.
- تدمجها في Score Matrix (حيث ينطبق).
- تعرضها كـ context.

## ما لا تفعله المنصة

- لا تُنفذ تلقائياً.
- لا ترسل تنبيهات تلقائية.
- لا تُنشئ أوامر.
- لا تُغلق صفقات.
