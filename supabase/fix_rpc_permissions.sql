-- ============================================
-- إصلاح أمني عاجل: قفل الدوال اللي شغالة بصلاحية security definer
-- شغّل الملف ده في Supabase SQL Editor (بعد schema.sql)
-- ============================================
--
-- المشكلة: الدوال التلاتة دي (redeem_coupon, reorder_videos, reorder_sections)
-- معمولها security definer، يعني بتشتغل بصلاحيات كاملة بتتخطى الـ RLS.
-- Supabase بيدي صلاحية تنفيذ أي دالة في public schema لـ anon/authenticated
-- تلقائيًا، فأي حد مسجل دخول (حتى طالب) كان يقدر ينادي الدالة دي مباشرة من
-- المتصفح (عن طريق supabase.rpc(...)) من غير ما يعدي على أي تحقق ملكية
-- موجود في الـ API routes بتاعتنا - يعني يستخدم كوبون معلم تاني، أو يرتب
-- فيديوهات/أقسام كورس مش بتاعه.
--
-- الحل: نمنع anon/authenticated من نداء الدوال دي مباشرة، ونسيبها service_role بس
-- (اللي بيستخدمه السيرفر عندنا بعد ما يعمل كل التحققات اللازمة).

revoke execute on function redeem_coupon(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function redeem_coupon(uuid, uuid, uuid) to service_role;

revoke execute on function reorder_videos(uuid[]) from public, anon, authenticated;
grant execute on function reorder_videos(uuid[]) to service_role;

revoke execute on function reorder_sections(uuid[]) from public, anon, authenticated;
grant execute on function reorder_sections(uuid[]) to service_role;

-- ============================================
-- تحقق بعد التشغيل (اختياري): الاستعلام ده المفروض يرجع الصفوف التلاتة
-- بعمود grantee = service_role بس (مفيش anon ولا authenticated)
-- ============================================
-- select routine_name, grantee, privilege_type
-- from information_schema.routine_privileges
-- where routine_name in ('redeem_coupon', 'reorder_videos', 'reorder_sections');
