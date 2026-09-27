# XAUUSD SMC Quant — Python High-Performance Data & Backtesting Layer

طبقة الحوسبة الكمية عالية الأداء وتحليل البيانات الضخمة لمنظومة تداول الذهب المؤسساتي.

---

## 📌 المكونات الأساسية (Core Architecture)
1. **Polars Data Engine**: معالجة سلاسل البيانات الزمنية والشموع اليابانية الفورية والآجلة بأقصى سرعة بدون حلقات تكرارية (Vectorized & Zero-Copy).
2. **DuckDB In-Memory OLAP**: استعلامات تحليلية فائقة السرعة على ملفات Parquet لتوليد إحصائيات السيولة والتمركز.
3. **Institutional Feature Engineering**: حساب مؤشرات ATR المؤسساتي، VWAP، RSI، ودلتا تدفق الأوامر التراكمي (CVD Delta).
4. **FastAPI Microservice**: خادم API عالي الكفاءة يربط طبقة بايثون بخادم Node.js الرئيسي عبر اتصالات REST سريعة.

---

## 🛠️ إرشادات التثبيت والتشغيل (Setup Instructions)

### 1. إعداد البيئة الافتراضية
```bash
cd python
python3 -m venv .venv
source .venv/bin/activate  # في لينكس / ماك
# أو في ويندوز: .venv\Scripts\activate
```

### 2. تثبيت الحزم المطلوبة
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. تشغيل خادم FastAPI
```bash
python api.py
# أو باستخدام uvicorn مباشرة:
# uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🔒 قواعد السلامة الصارمة (Strict Quant Directives)
- **انعدام البيانات الوهمية**: لا يُسمح نهائياً باستخدام `random` أو أرقام عشوائية.
- **التعامل مع انقطاع البيانات**: رمي استثناء صريح مكافئ لـ `DataUnavailableError` عند نقص الشموع أو تعذر الجلب.
- **التخزين بصيغة Parquet**: تخزين البيانات التاريخية المضغوطة لتسريع عمليات الـ Backtest والمحاكاة المؤسساتية.
