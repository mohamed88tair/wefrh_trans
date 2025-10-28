# إعداد قاعدة البيانات - Supabase PostgreSQL

## ✅ تم إنشاء قاعدة البيانات بنجاح!

تم إنشاء وتكوين قاعدة بيانات Supabase كاملة لنظام الترجمة متعدد اللغات.

## 📊 الجداول المنشأة (10 جداول)

### 1. **users** - حسابات المستخدمين
- `id`, `username`, `password`
- للمصادقة وتسجيل الدخول (سيتم تفعيلها لاحقاً)

### 2. **translation_projects** - مشاريع الترجمة
- 18 حقل يشمل: الاسم، نوع الملف، الحجم، التقدم، الحالة
- `id`, `name`, `file_name`, `file_type`, `total_items`, `translated_items`, `progress_percentage`
- يحتوي على البيانات الوصفية للملف الأصلي والتنسيق

### 3. **translation_items** - عناصر الترجمة الفردية
- 9 حقول للنصوص الأصلية والمترجمة
- `id`, `project_id`, `key`, `original_text`, `translated_text`, `status`
- مرتبطة بـ translation_projects عبر `project_id`

### 4. **api_settings** - إعدادات مزودي API
- `id`, `provider`, `api_key`, `model`, `is_active`
- لحفظ مفاتيح OpenAI, Gemini, Anthropic, xAI, DeepSeek

### 5. **global_settings** - الإعدادات العامة للنظام
- `setting_key`, `setting_value`, `description`
- **8 إعدادات افتراضية** تم إضافتها:
  - `manualTranslationModel`: gemini-1.5-pro
  - `batchTranslationModel`: gemini-1.5-flash
  - `defaultProvider`: gemini
  - `autoSaveEnabled`: true
  - `smartGroupingEnabled`: true
  - `cacheEnabled`: true
  - `maxBatchSize`: 50
  - `translationTimeout`: 30000

### 6. **background_tasks** - المهام الخلفية
- 15 حقل لتتبع عمليات الترجمة الطويلة
- `id`, `project_id`, `type`, `status`, `progress`, `total_items`, `processed_items`
- لإدارة الترجمة المجمعة والإيقاف/الاستئناف

### 7. **system_logs** - سجلات النظام
- 19 حقل لتسجيل جميع الأحداث والأخطاء
- يشمل تتبع تكلفة AI: `ai_model`, `input_tokens`, `output_tokens`, `estimated_cost`
- فهرسة على: timestamp, category, level, project_id

### 8. **project_settings** - إعدادات لكل مشروع
- `manual_translation_model`, `batch_translation_model`, `default_provider`
- `auto_save_enabled`, `smart_grouping_enabled`, `cache_enabled`

### 9. **ai_models** - نماذج الذكاء الاصطناعي
- **17 نموذج AI تم إضافتهم** مع الأسعار والقدرات:

  **OpenAI (4 نماذج)**:
  - GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo

  **Google Gemini (3 نماذج)**:
  - Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 1.5 Flash 8B

  **xAI (3 نماذج)**:
  - Grok 2, Grok 2 Vision, Grok Beta

  **Anthropic Claude (5 نماذج)**:
  - Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku

  **DeepSeek (2 نماذج)**:
  - DeepSeek Chat, DeepSeek Coder

### 10. **usage_stats** - إحصائيات الاستخدام
- لتتبع استخدام كل نموذج AI حسب التاريخ والمشروع
- `model_id`, `project_id`, `request_count`, `input_tokens`, `output_tokens`, `total_cost`

## 🔐 الأمان (Row Level Security)

- تم تفعيل RLS على **جميع الجداول**
- تم إضافة سياسات مؤقتة للسماح بجميع العمليات (للتطوير)
- **مهم**: يجب تحديث السياسات لاحقاً عند إضافة نظام المصادقة

## 📈 الفهارس (Indexes)

تم إنشاء **14 فهرس** لتحسين الأداء:
- translation_items: `project_id`, `status`, `selected`
- system_logs: `timestamp`, `category`, `level`, `project_id`
- project_settings: `project_id`
- ai_models: `provider`, `is_active`
- usage_stats: `model_id`, `project_id`, `date`

## 🔄 العلاقات (Foreign Keys)

- `translation_items.project_id` → `translation_projects.id` (CASCADE DELETE)
- `background_tasks.project_id` → `translation_projects.id` (CASCADE DELETE)
- `project_settings.project_id` → `translation_projects.id` (CASCADE DELETE)

## 🚀 التغييرات المطبقة

### 1. إعداد البيئة
✅ تم إضافة `DATABASE_URL` إلى ملف `.env`

### 2. إنشاء Schema
✅ تم تطبيق Migration كامل على Supabase
✅ جميع الجداول والفهارس والعلاقات جاهزة

### 3. البيانات الأساسية
✅ 17 نموذج AI مع الأسعار
✅ 8 إعدادات عامة افتراضية

### 4. طبقة التخزين
✅ تم إنشاء `server/storage-database.ts` جديد
✅ تم تحديث `server/routes.ts` لاستخدام قاعدة البيانات
✅ نظام Logger يستخدم قاعدة البيانات بالفعل

## ⚠️ خطوة مطلوبة

**يجب تحديث DATABASE_URL في ملف `.env`**

الملف الحالي يحتوي على:
```
DATABASE_URL=postgresql://postgres.uriofhkdgujkgmagtqtb:YourPasswordHere@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

للحصول على Connection String الصحيح:
1. اذهب إلى Supabase Dashboard
2. Project Settings → Database
3. انسخ Connection String (Session pooler)
4. استبدل `YourPasswordHere` بكلمة المرور الفعلية

**أو** يمكنك استخدام Connection Pooling URI:
```
DATABASE_URL=postgresql://postgres.uriofhkdgujkgmagtqtb:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

## 🧪 الاختبار

بعد تحديث DATABASE_URL، يمكنك اختبار الاتصال:

```bash
npx tsx test-db-connection.ts
```

سيقوم السكريبت بـ:
- اختبار الاتصال بقاعدة البيانات
- استرجاع النماذج والإعدادات
- إنشاء مشروع اختباري
- إضافة عناصر ترجمة
- تحديث البيانات
- حذف البيانات التجريبية

## 📦 ما تم إنجازه

✅ إنشاء 10 جداول كاملة
✅ إضافة 17 نموذج AI مع الأسعار
✅ إضافة 8 إعدادات افتراضية
✅ تفعيل Row Level Security
✅ إنشاء 14 فهرس للأداء
✅ ربط جميع العلاقات (Foreign Keys)
✅ إنشاء طبقة Storage جديدة
✅ تحديث Routes لاستخدام قاعدة البيانات
✅ البناء ناجح (Build successful)

## 🎯 الخطوات التالية

1. **تحديث DATABASE_URL** في `.env` بكلمة المرور الصحيحة
2. تشغيل النظام: `npm run dev`
3. اختبار إنشاء مشروع جديد من الواجهة
4. مراجعة Supabase Dashboard لرؤية البيانات
5. (اختياري) تحديث سياسات RLS عند إضافة نظام المصادقة

## 📊 إحصائيات

- **10 جداول** مع علاقات كاملة
- **17 نموذج AI** جاهزة للاستخدام
- **8 إعدادات عامة** افتراضية
- **14 فهرس** لتحسين الأداء
- **3 علاقات** Foreign Keys مع CASCADE DELETE
- **استعلامات محسّنة** مع Drizzle ORM

---

**النظام جاهز للعمل بمجرد تحديث DATABASE_URL! 🚀**
