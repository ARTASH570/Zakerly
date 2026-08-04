# ملاحظات إعادة الهيكلة (Refactor Notes)

## 1) إعادة التنظيم (Feature-based)

### الملفات اللي اتنقلت (نفس المحتوى، غيرنا المكان بس + حدّثنا الاستيرادات):

| قبل | بعد |
|---|---|
| `lib/supabaseClient.ts` | `lib/supabase/client.ts` |
| `lib/supabaseAdmin.ts` | `lib/supabase/admin.ts` |
| `lib/csrf.ts` | `lib/shared/csrf.ts` |
| `lib/rateLimit.ts` | `lib/shared/rateLimit.ts` |
| `lib/validation.ts` | `lib/shared/validation.ts` |
| `lib/activityLog.ts` | `lib/shared/activityLog.ts` |
| `lib/report.ts` | `lib/shared/report.ts` |
| `lib/auth.ts` | `features/auth/lib/auth.ts` |
| `lib/bunny.ts` | `features/videos/lib/bunny.ts` |
| `lib/stripe.ts` | `features/payments/lib/stripe.ts` |
| `lib/paypal.ts` | `features/payments/lib/paypal.ts` |
| `lib/paymob.ts` | `features/payments/lib/paymob.ts` |
| `lib/coupons.ts` | `features/payments/lib/coupons.ts` |
| `components/VideoPlayer.tsx` | `features/videos/components/VideoPlayer.tsx` |
| `components/VideoUploader.tsx` | `features/videos/components/VideoUploader.tsx` |
| `components/PaymentButton.tsx` | `features/payments/components/PaymentButton.tsx` |

`components/LogoutButton.tsx` فضل مكانه لأنه UI مشترك مش خاص بميزة معينة.
`app/` فضل زي ما هو تمامًا (المسارات نفسها = نفس الروابط)، غيرنا بس مصدر الاستيراد جواه.

**تم تحديث الاستيرادات في 45 ملف تلقائيًا** (باستخدام sed على مسارات `@/...` بس، مفيش تعديل يدوي عشوائي). تم التحقق برمجيًا إن كل الـ 190 استيراد بمسار `@/` بترجع لملف موجود فعلاً.

### لم يتم تغييره:
- أسماء متغيرات البيئة (env vars) — زي ما هي 100%
- أسماء جداول قاعدة البيانات الموجودة — زي ما هي 100%
- `middleware.ts`, `next.config.js` — لم تُلمس
- منطق أي API route أو صفحة — نفس الكود بالظبط، غير مكان الملف والاستيراد بس

## 2) ميزة الشات الجديدة (معلم ↔ طالب)

### ⚠️ خطوة لازم تعملها يدويًا قبل التشغيل:
شغّل ملف `supabase/chat_schema.sql` في Supabase SQL Editor (بعد `schema.sql`).
الملف بيضيف جدولين جداد: `chat_conversations` و `chat_messages`، مع RLS كاملة.

**كمان لازم تروح يدويًا لـ:** Supabase Dashboard → Database → Replication → فعّل جدول `chat_messages` (عشان الرسائل توصل لحظيًا Realtime).

### الملفات الجديدة:
- `supabase/chat_schema.sql` — الجداول + RLS + تفعيل Realtime
- `features/chat/types/index.ts` — الأنواع (Types)
- `features/chat/lib/chat.ts` — منطق الأعمال (إنشاء محادثة، إرسال، قراءة)
- `features/chat/hooks/useChatMessages.ts` — Hook للرسائل + الاشتراك اللحظي
- `features/chat/hooks/useConversations.ts` — Hook لقايمة المحادثات
- `features/chat/components/ChatWindow.tsx` — نافذة المحادثة
- `features/chat/components/ConversationList.tsx` — قايمة المحادثات
- `app/api/chat/conversations/route.ts` — GET (القايمة) / POST (بدء محادثة)
- `app/api/chat/conversations/[id]/messages/route.ts` — GET (الرسائل) / POST (إرسال)
- `app/api/chat/conversations/[id]/read/route.ts` — تعليم كمقروء
- `app/teacher/messages/page.tsx` — صفحة رسائل المعلم
- `app/student/messages/page.tsx` — صفحة رسائل الطالب

### قيود الأمان المطبقة:
- محادثة بس بين معلم وطالب مرتبطين فعليًا (الطالب مشترك في كورس من كورسات المعلم)
- كل الكتابة بتتحقق من هوية المرسل ودوره الحقيقي (سيرفر + RLS مع بعض)
- Rate limiting: 60 رسالة/دقيقة لكل مستخدم، 30 محادثة جديدة/ساعة
- حد أقصى 2000 حرف للرسالة

### ربط في الواجهة:
- اتضاف زرار "الرسائل" في `app/teacher/dashboard/page.tsx` و `app/student/dashboard/page.tsx`

## 3) اختبار مطلوب منك يدويًا

- [ ] `npm install` ثم `npm run dev` — اتأكد إن المشروع بيقوم من غير أخطاء imports
- [ ] سجّل دخول كمعلم وكطالب (حسابين مختلفين) في نفس الكورس/اشتراك
- [ ] افتح `/student/messages` وابدأ محادثة مع المعلم
- [ ] افتح `/teacher/messages` بحساب المعلم في تاب تاني، وابعت رسالة — اتأكد إنها توصل فورًا للطالب من غير Refresh (Realtime)
- [ ] جرب صفحات الدفع والفيديوهات القديمة (courses, videos upload/playback) للتأكد إن نقل lib/components ماكسرش حاجة
- [ ] راجع أي استيراد مخصص كنت مضيفه بنفسك لو فيه فروع/تعديلات مش موجودة في النسخة اللي بعتهالي

## 4) نقطة مهمة

الـ build الكامل (`npm run build` / type-check) **متعملش هنا** لأن بيئة التنفيذ عندي من غير اتصال إنترنت (متقدرش أعمل `npm install`). تم عمل فحص برمجي بديل: التأكد إن كل استيراد بمسار `@/` بيتحل لملف موجود فعلًا، وفحص توازن الأقواس في كل ملف اتلمس. برضو لازم تشغّل `npm run build` عندك للتأكد النهائي.

## 5) إصلاحات أمان/منطق (بعد المراجعة الكاملة للكود)

### 🔴 إصلاح 1: ترتيب الفيديوهات الجديدة (`app/api/videos/create/route.ts`)
**المشكلة:** الفيديو الجديد كان بيتسجل من غير تحديد `order_index`، فكان بياخد القيمة الافتراضية `0` دايمًا. النتيجة: كل الفيديوهات في نفس القسم بتتساوى في الترتيب لحد ما المعلم يعمل drag-and-drop يدوي، فترتيب العرض للطالب كان غير موثوق.
**الإصلاح:** بنجيب أعلى `order_index` موجود في نفس القسم ونحط الفيديو الجديد بعده مباشرة — نفس الباترن المستخدم بالظبط في `sections/create/route.ts`.
**التأثير:** إصلاح محلي 100%، معدّلش أي منطق تاني، مجرد سطر واحد إضافي في الـ insert.

### 🔴 إصلاح 2: ثغرة صلاحيات في `app/api/sections/reorder/route.ts`
**المشكلة:** الكود كان بيتحقق إن `courseId` بتاع المعلم، لكن معملش أي تحقق إن الـ `orderedSectionIds` المبعوتة فعلاً بتاعة نفس الكورس ده. من الناحية النظرية، معلم كان يقدر يبعت section ID بتاع معلم تاني ضمن القايمة ويأثر على ترتيبه.
**الإصلاح:** أضفنا نفس الـ "count check" الموجود بالفعل في `videos/reorder/route.ts` (نتأكد إن عدد الأقسام اللي رجعت من فلترة `course_id = courseId AND id IN (...)` بيساوي بالظبط عدد الـ IDs المبعوتة، ولو مش متطابقين بنرفض الطلب).
**التأثير:** إصلاح محلي 100%، نفس الباترن الأمني المستخدم في باقي المشروع، مفيش أي تغيير في السلوك الطبيعي للمعلم وهو بيرتب أقسام كورسه بشكل عادي.

### 🟡 إصلاح 3: تصنيف الأدمن غلط في activity_logs (login / logout / reset-password)
**المشكلة:** الأكواد كانت بتتحقق من جدول `teachers` بس، ولو مش لاقية، تفترض `student` تلقائيًا — فلو الأدمن سجل دخول/خروج، كان بيتسجل في السجل بدور "student" غلط.
**الإصلاح:** أضفنا خطوة تحقق من جدول `admins` كمان (نفس باترن `requireAdmin()` الموجود بالفعل)، في الثلاث ملفات.
**⚠️ تعديل مطلوب في قاعدة البيانات:** الـ CHECK constraint بتاع `activity_logs.user_role` كان بيسمح بـ `teacher`/`student`/`system` بس. أضفت ملف SQL منفصل **`supabase/activity_log_admin_role.sql`** يضيف `admin` كقيمة مسموحة — **لازم تشغّله يدويًا في SQL Editor** قبل ما الإصلاح ده يشتغل، وإلا الـ login هيرمي خطأ لو حاول أدمن يسجل دخول (الكود بيتعامل مع فشل اللوج بأمان زي ما هو موضح في `logActivity`، فمش هيوقف تسجيل الدخول نفسه، بس السجل هيفضل يتسجل غلط لحد ما تشغّل الملف).

### 🟡 إصلاح 4: إجمالي الإيرادات في `admin/overview`
**المشكلة:** كان بيتحسب من آخر 50 دفعة بس (بسبب `.limit(50)` المستخدمة أصلًا لعرض جدول الدفعات).
**الإصلاح:** استعلام منفصل وخفيف (عمود `amount` بس، فلترة `status = success`، من غير limit) بيحسب الإجمالي الحقيقي. جدول الـ 50 دفعة للعرض فضل زي ما هو من غير أي تغيير.

### 🟡 إصلاح 5: حساب معلّق لو فشل التسجيل بعد نجاح auth.signUp
**المشكلة:** لو `supabase.auth.signUp` نجح لكن الـ insert في `teachers`/`students` فشل بعده، كان بيفضل حساب في `auth.users` من غير دور — قادر يسجل دخول بس النظام معرفش يتعامل معاه.
**الإصلاح:** لو فشل إنشاء صف البروفايل، بنعمل rollback فوري بحذف حساب الـ auth اللي اتعمل لتوه (`supabaseAdmin.auth.admin.deleteUser`)، فالتسجيل يفشل بشكل نضيف والشخص يقدر يحاول تاني من الصفر.

### 🟡 إصلاح 6: صفحة تسجيل الدخول كانت بتوجّه حسب التاب المختار، مش الدور الحقيقي
**المشكلة:** بعد تسجيل الدخول، الـ redirect كان بيعتمد على تاب "معلم/طالب" اللي مضغوط في الواجهة، مش على نوع الحساب الفعلي.
**الإصلاح:** `login/route.ts` بقى بيرجع `role` الحقيقي المتحقق منه من السيرفر ضمن الـ response، وصفحة `/login` بقت بتستخدم القيمة دي للتوجيه (مع fallback آمن للتاب المختار لو لأي سبب السيرفر ماردش role). كمان أضفنا توجيه لـ `/admin/dashboard` لو الدور طلع admin (كان مفقود قبل كده خالص).

### 🟡 إصلاح 7: مفيش rate limit على `app/api/payments/paypal/capture/route.ts`
**المشكلة:** كل باقي راوتات الدفع (`stripe/create`, `paypal/create`, `paymob/create`) عليها rate limiting، لكن `paypal/capture` كان الوحيد الناقص، رغم إنه بيكلم PayPal API فعليًا في كل استدعاء — طالب يقدر يستدعيه بسرعة كتير مرات ويستنزف الموارد أو يخلي PayPal يحظر الـ integration مؤقتًا.
**الإصلاح:** أضفنا نفس الباترن المستخدم في `paypal/create` (10 محاولات/5 دقايق لكل طالب)، بنفس اسم مفتاح الـ rate limit المستخدم في باقي راوتات الدفع (`payment-capture:{studentId}`).

### 🔴 إصلاح 8: دوال RPC (redeem_coupon, reorder_videos, reorder_sections) كانت متاحة للنداء المباشر من المتصفح
**المشكلة:** الدوال التلاتة دي معمولها `security definer` (بتتخطى الـ RLS بالكامل)، لكن معملهاش `revoke execute` زي ما اتعمل بالظبط مع `find_user_id_by_email`. النتيجة: Supabase بيدي صلاحية تنفيذها تلقائيًا لـ `anon`/`authenticated`، فأي حساب مسجل دخول (حتى طالب) كان يقدر ينادي `supabase.rpc('redeem_coupon', ...)` أو `reorder_videos`/`reorder_sections` مباشرة من المتصفح، من غير ما يعدي خالص على تحققات الملكية/الاشتراك الموجودة في الـ API routes بتاعتنا - يعني يستخدم كوبون معلم تاني، أو يرتب فيديوهات/أقسام كورس مش بتاعه.
**الإصلاح:** ملف جديد **`supabase/fix_rpc_permissions.sql`** بيعمل `revoke execute ... from public, anon, authenticated` + `grant execute ... to service_role` على الدوال التلاتة. **لازم تشغّله يدويًا في SQL Editor** - أولوية قصوى قبل أي إطلاق فعلي، لأن ده بايباس كامل مش تفصيلة بسيطة.
**التأثير:** لا تغيير في السلوك الطبيعي للتطبيق - كل نداءات الدوال دي أصلًا بتحصل من السيرفر عن طريق `supabaseAdmin` (service role)، فمفيش أي مسار شرعي هيتأثر.

### 🟠 إصلاح 9: باگ العملة - السعر بالجنيه كان بيتبعت لـ Stripe/PayPal 1:1 كأنه دولار
**المشكلة:** `stripe/create/route.ts` و`paypal/create/route.ts` كانوا بياخدوا `finalPrice` (محسوب بالجنيه) ويبعتوه لـ Stripe/PayPal كأنه بالدولار من غير أي تحويل - كورس بـ 500 جنيه كان بيتحصّل فعليًا كـ 500 دولار.
**الإصلاح:** دالة جديدة `egpToUsdCents()` في **`features/payments/lib/currency.ts`** بتحول السعر باستخدام سعر صرف ثابت من متغير بيئة جديد `EGP_TO_USD_RATE`. لو المتغير مش متظبط أو غير صحيح، الدالة بترمي خطأ واضح والراوت بيرجّع 503 ("الدفع بالدولار مش متاح دلوقتي") بدل ما يكمل بسعر غلط - وده قبل ما نعمل أي سجل دفع "pending"، عشان منسيبش صفوف يتيمة في جدول payments.
**⚠️ تعديل مطلوب منك:** لازم تضيف `EGP_TO_USD_RATE` في متغيرات البيئة (مثلاً `0.021` لو الدولار بـ ~47 جنيه) قبل ما تفعّل Stripe/PayPal - وإلا الطالب هياخد رسالة "الدفع بالدولار مش متاح" وده مقصود (أأمن من سعر غلط). ده سعر صرف ثابت بتحدّثه إنت يدويًا، مش سعر حي - لو حابب تحويل أوتوماتيكي لازم تربطه بـ API سعر صرف خارجي بدل كده.

### 🟡 إصلاح 10: تشديد إضافي بعد المراجعة الأمنية
- **CSP:** `script-src` كان فيه `'unsafe-inline' 'unsafe-eval'` حتى في الإنتاج (next.config.js)، وده بيلغي معظم فايدة الحماية من XSS. بقى الاتنين شغالين في وضع التطوير بس. **⚠️ لازم تختبر الـ build في الإنتاج كويس بعد التعديل ده** - Next.js أحيانًا بيحقن سكريبتات inline لبيانات الـ hydration، ولو حصل كده هتحتاج نظام nonce بدل الحذف الكامل (مش تم عمل ده هنا - محتاج اختبار فعلي على بيئتك).
- **CSRF:** `verifyRequestOrigin()` في `lib/shared/csrf.ts` كان بيسمح بكل الطلبات (`return true`) لو `NEXT_PUBLIC_SITE_URL` مش متظبط - فشل صامت خطير. بقى دلوقتي بيرفض الطلبات (`return false`) ويسجل تحذير واضح في اللوج، عشان أي نسيان في الإعداد يبان فورًا بدل ما يفضل ثغرة صامتة.
- **Rate limiting:** `lib/shared/rateLimit.ts` بقى بيطبع تحذير `console.error` واضح وقت تشغيل السيرفر لو إحنا في الإنتاج ومفيش متغيرات Upstash متظبطة (كان بيرجع للـ fallback بصمت من غير أي إشارة في اللوجات).
- **فهارس ناقصة:** ملف جديد **`supabase/add_missing_indexes.sql`** بيضيف index على `payments.course_id` و`enrollments.course_id` (كانوا بيعتمدوا بس على الـ index الضمني من unique constraint اللي عموده الرئيسي student_id).

### ✅ تم التحقق بعد كل الإصلاحات الأخيرة (3 → 7):
- توازن الأقواس في كل ملف اتلمس: سليم
- كل الـ 190 استيراد بمسار `@/` في المشروع كله: لسه بيتحلوا صح


الـ build الكامل (`npm run build` / type-check) **متعملش هنا** لأن بيئة التنفيذ عندي من غير اتصال إنترنت (متقدرش أعمل `npm install`). تم عمل فحص برمجي بديل: التأكد إن كل استيراد بمسار `@/` بيتحل لملف موجود فعلًا (190 استيراد، كلهم سليمين)، وفحص توازن الأقواس في كل ملف جديد. برضو لازم تشغّل `npm run build` عندك للتأكد النهائي.
