# 🌟 XAUUSD SMC Quant Platform — منصة تداول الذهب المؤسساتي

منصة تداول خوارزمية وكمية مؤسساتية متكاملة لأسواق الذهب الفورية والعقود الآجلة (`XAU/USD` & `COMEX:GC1!`) بالاعتماد على مفاهيم الأموال الذكية المتقدمة (Smart Money Concepts - SMC)، تدفق الأوامر الحقيقي (CVD Delta)، التحليل الاقتصادي الكلي (FRED Macro & CFTC COT)، ومحرك الحوسبة فائق السرعة عبر Polars و DuckDB.

---

## 🏛️ نظرة عامة على المشروع (Project Overview)

### بالعربية:
تم تصميم المنصة لتوفير دقة استثنائية لصناع السوق والمتداولين المؤسساتيين عبر 5 ركائز رئيسية:
1. **حل معضلة الحجم (Real COMEX Futures Volume & CVD)**: ربط حجم التداول الحقيقي من بورصة شيكاغو لتأكيد ارتدادات السعر الفوري.
2. **سحب سيولة ما بعد الأخبار (قاعدة الـ 15 دقيقة)**: تجنب مصائد السيولة وقت صدور الأخبار الكبرى (CPI / NFP) واصطياد انعكاسات سحب الذيول.
3. **انضغاط السعر وفلتر الذيول المحمي**: حساب وقف خسارة محمي بدقة تعتمد على ATR ونضارة مناطق الـ Order Blocks مع فرض نسبة عائد إلى مخاطرة لا تقل عن `1:2.0`.
4. **المطابقة المزدوجة (Spot-Futures Fusion Layer)**: فحص الفارق السعري (Basis Z-Score) وكشف التوافق أو التباعد اللحظي.
5. **طبقة بايثون الحسابية (Python VectorBT & DuckDB Layer)**: تنفيذ اختبارات استرجاعية (Backtesting)، محاكاة مونت كارلو بـ 10,000 مسار، وتوزيعات MAE/MFE لتحسين الأداء.

### In English:
The XAUUSD SMC Quant Platform bridges the gap between Spot FX liquidity (`OANDA:XAUUSD`) and exchange-traded futures contracts (`COMEX:GC1!`). It integrates institutional volume flow, real-time basis tracking, economic regime clustering (FRED & CFTC COT), VectorBT execution simulation, and an automated Telegram alert dispatch pipeline.

---

## 📐 مخطط الهيكلية (Architecture Diagram)

```
                       ┌────────────────────────┐
                       │  Institutional Clients │
                       │ (React 18 + Vite UI)   │
                       └───────────▲────────────┘
                                   │
                           REST API / WebSockets
                                   │
                       ┌───────────▼────────────┐
                       │   Node.js / Express    │
                       │   (server/server.ts)   │
                       └─────┬────────────┬─────┘
                             │            │
             ┌───────────────┘            └────────────────┐
             ▼                                             ▼
 ┌───────────────────────┐                     ┌───────────────────────┐
 │   Analytical Engines  │                     │ Python Quant Engine   │
 │ • SpotEngine (XAUUSD) │                     │ • Polars & DuckDB     │
 │ • FuturesEngine (GC1!)│                     │ • VectorBT & TCA      │
 │ • ComparisonEngine    │                     │ • Monte Carlo & Optuna│
 │ • Macro / COT / FRED  │                     │ • FastAPI (Port 8000) │
 └───────────┬───────────┘                     └───────────────────────┘
             │
             ▼
 ┌───────────────────────┐
 │  Execution & Alerts   │
 │ • AlertDispatcher     │
 │ • Telegram Bot API    │
 │ • SQLite / Parquet    │
 └───────────────────────┘
```

---

## 🚀 التشغيل والتثبيت (Setup & Running)

### 1. المتطلبات المسبقة (Prerequisites)
- **Node.js**: v18+ أو v20+
- **Python**: v3.10+ مع تثبيت `pip`
- **SQLite3** مدمج في النظام

### 2. تثبيت الحزم (Installation)
```bash
# تثبيت تبعيات خادم وواجهة Node.js
npm install

# تثبيت مكتبات بايثون الكمية
cd python
pip install -r requirements.txt
cd ..
```

### 3. متغيرات البيئة (Environment Variables)
قم بإنشاء ملف `.env` مستنداً إلى `.env.example`:
```ini
PORT=3000
PYTHON_SERVICE_URL=http://127.0.0.1:8000
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_channel_or_group_id
FRED_API_KEY=your_fred_api_key_optional
```

### 4. تشغيل المنصة (Running the Application)
```bash
# تشغيل خادم المنصة والتطوير
npm run dev

# تشغيل طبقة بايثون (اختياري للتحليلات المتقدمة والباك تيست)
cd python && python api.py
```

### 5. تشغيل الاختبارات الشاملة (Running Tests)
```bash
npm test
```
تشمل أكثر من 90 اختبار وحدة وتكامل صارم يغطي كافة المحركات ونماذج التحليل المؤسساتي.

---

## 📊 مصادر البيانات الصارمة (Data Sources)
- **Real Candles Only**: الاعتماد الحصري على بيانات حقيقية موثقة من مصادر السيولة (TradingView / OANDA / COMEX).
- **قاعدة منع البيانات العشوائية (Zero Fake Data Guarantee)**: خلو الكود تماماً من أي دوال عشوائية (`Math.random`) في منطق الحسابات، ورمي استثناء `DataUnavailableError` صريح عند عدم توفر البيانات.

---

## 👥 المساهمة والتطوير (Contributing)
1. الالتزام بجميع القواعد والمعايير في ملف `AGENTS.md`.
2. المحافظة على نجاح الفحص البرمجي واختبارات الأنواع الصارمة (`npm run lint`).
3. التأكد من اجتياز كامل حزمة الاختبارات (`npm test`) قبل اعتماد أي تعديل.
