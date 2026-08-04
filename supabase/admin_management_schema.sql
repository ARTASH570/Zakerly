-- ============================================
-- Elmodares - إدارة الأدمنز (ترقية مستخدم موجود لأدمن من داخل لوحة التحكم)
-- شغّل الملف ده في Supabase SQL Editor بعد schema.sql
-- ============================================

-- بنضيف عمود الإيميل لجدول admins عشان نقدر نعرضه في القائمة من غير ما
-- نحتاج نستدعي auth.admin API في كل مرة نفتح فيها صفحة إدارة الأدمنز
alter table admins add column if not exists email text;

-- ⚠️ جدول auth.users مش متاح مباشرة عن طريق مكتبة supabase-js (PostgREST بيعرض
-- سكيمة public بس بشكل افتراضي). عشان نقدر نلاقي id المستخدم من الإيميل بتاعه
-- (علشان نرقّيه لأدمن)، محتاجين function بصلاحيات security definer تقرا من
-- auth.users وترجع id بس - من غير ما تكشف أي بيانات حساسة تانية.
create or replace function find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = auth, public
as $$
  select id from auth.users where email = p_email limit 1;
$$;

-- نمنع أي حد يستدعيها مباشرة من المتصفح (حتى لو مسجل دخول) - السيرفر بس
-- (بمفتاح service role) اللي المفروض يستخدمها، عن طريق API route محمي بـ requireAdmin
revoke execute on function find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function find_user_id_by_email(text) to service_role;
