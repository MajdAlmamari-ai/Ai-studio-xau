# XAUUSD SMC Quant Platform — Legacy Preservation Archive (`_legacy/`)

> **STATUS**: READ-ONLY PRESERVATION ARCHIVE  
> **Date of Snapshot**: 2026-09-12  
> **Source Project**: XAUUSD SMC Quant Platform v2.5.0  

---

## 1. الغرض من هذا الأرشيف (Purpose)
هذا المجلد يحتوي على النسخة الكاملة والأصلية من مشروع **XAUUSD SMC Quant Platform v2.5.0** المحفوظة بالكامل للقراءة والمراجعة والتدقيق والرجوع إليها (Read-Only).

## 2. المحتويات المحفوظة (Preserved Components)
- `src/`: كافة مكونات الواجهة والشارتات والخدمات وخوارزميات SMC.
- `server/`: خوادم ومحركات الأسعار وتدفق الأوامر ومجدول المهام والتكامل المؤسساتي.
- `server.ts`: نقطة دخول خادم Express وواجهات API وقواطع الأمان.
- `tests/`: اختبارات المنظومة والوحدات.
- `package.json`, `tsconfig.json`, `vite.config.ts`: إعدادات البيئة والتجميع.
- `AGENTS.md`: التوجيهات والإرشادات المؤسساتية الصارمة.
- `firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.rules`: تكوينات فايربيس وقواعد الأمان.

## 3. الأمان والملاحظات (Security Notes)
يرجى مراجعة ملف `SECURITY_NOTES.md` في هذا المجلد للاطلاع على توثيق بيانات الاعتماد وتأجيل تدوير المفاتيح وقواعد فايربيس وفق توجيهات المالك.
