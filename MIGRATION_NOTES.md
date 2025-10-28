# قاعدة البيانات - ملاحظات الترحيل

## التغييرات المنفذة

تم ترحيل المشروع بنجاح من **Neon PostgreSQL** إلى **Supabase PostgreSQL**.

### 1. الحزم والتبعيات

#### تم إزالة:
- `@neondatabase/serverless` - حزمة Neon Database
- `ws` - WebSocket library (كانت مطلوبة لـ Neon)

#### تم إضافة:
- `@supabase/supabase-js` - Supabase Client SDK
- `postgres` - PostgreSQL client for Node.js (drizzle-compatible)

### 2. ملفات التكوين

#### `.env`
تم تحديث متغيرات البيئة:
```env
SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres.0ec90b57d6e95fcbda19832f:@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

#### `server/db.ts`
تم استبدال Neon connection بـ Postgres.js:
```typescript
// قبل
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

// بعد
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
```

#### `drizzle.config.ts`
تم تحديث مسار migrations:
```typescript
out: "./supabase/migrations"  // كان: "./migrations"
```

### 3. ملفات جديدة

#### `server/supabase.ts`
ملف جديد لإعداد Supabase Client (للاستخدام المستقبلي):
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

### 4. قاعدة البيانات

#### الجداول (10 جداول):
1. `users` - 3 أعمدة
2. `translation_projects` - 18 عمود
3. `translation_items` - 9 أعمدة
4. `background_tasks` - 15 عمود
5. `api_settings` - 6 أعمدة
6. `global_settings` - 5 أعمدة
7. `system_logs` - 19 عمود
8. `project_settings` - 10 أعمدة
9. `ai_models` - 12 عمود
10. `usage_stats` - 9 أعمدة

#### الفهارس (27 فهرس):
- Primary keys لجميع الجداول
- Unique constraints على المفاتيح المناسبة
- Performance indexes على الأعمدة الأكثر استخداماً

#### Row Level Security (RLS):
- تم تمكين RLS على جميع الجداول
- جاهزة لإضافة policies عند الحاجة

### 5. Storage Layer

#### `server/storage.ts`
تم تحديث:
- إضافة imports من `db.ts` و `drizzle-orm`
- تبسيط interface للـ Project Settings
- إصلاح الاستعلامات المزدوجة في `getUntranslatedItems`

## الفوائد

1. **لا حاجة لخدمات خارجية**: Supabase مدمج بالكامل في Bolt.new
2. **أداء أفضل**: اتصال مباشر بدون websockets إضافية
3. **ميزات إضافية متاحة**:
   - Supabase Storage للملفات
   - Realtime subscriptions
   - Authentication (إذا احتجت)
4. **إدارة أسهل**: لوحة تحكم Supabase
5. **تكلفة أقل**: لا اشتراكات خارجية

## الاختبار

✅ تم اختبار الاتصال بقاعدة البيانات
✅ تم التحقق من وجود جميع الجداول (10 جداول)
✅ تم التحقق من جميع الأعمدة والفهارس
✅ نجح Build بدون أخطاء
✅ TypeScript type checking نظيف

## ملاحظات مهمة

- جميع البيانات المخزنة سابقاً في Neon لم يتم نقلها. إذا كنت بحاجة لنقل البيانات، يمكن استخدام `pg_dump` و `pg_restore`
- RLS مُفعّل لكن بدون policies حالياً (للسماح بالوصول الكامل مؤقتاً)
- يمكن الآن استخدام ميزات Supabase الإضافية حسب الحاجة

## الخطوات التالية (اختيارية)

1. إضافة RLS policies للأمان
2. استخدام Supabase Auth بدلاً من نظام المصادقة الحالي
3. استخدام Supabase Storage للملفات المرفوعة
4. إضافة Realtime subscriptions للتحديثات الفورية
5. استخدام Supabase Edge Functions للعمليات الخلفية
