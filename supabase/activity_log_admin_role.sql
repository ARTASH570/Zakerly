-- ============================================
-- إصلاح: السماح بـ 'admin' كقيمة صحيحة في activity_logs.user_role
-- شغّل الملف ده في Supabase SQL Editor (بعد schema.sql)
--
-- السبب: أكواد login/logout/reset-password كانت بتفترض إن أي حساب مش
-- معلم يبقى طالب تلقائيًا، فكانت بتسجل دخول/خروج الأدمن في السجل
-- (activity_logs) على إنه "student" غلط. اتصلح الكود عشان يتحقق من جدول
-- admins كمان، لكن قاعدة البيانات كانت بترفض القيمة 'admin' لأنها مش
-- ضمن الـ CHECK constraint الأصلي.
-- ============================================

alter table activity_logs drop constraint if exists activity_logs_user_role_check;
alter table activity_logs add constraint activity_logs_user_role_check
  check (user_role in ('teacher', 'student', 'admin', 'system'));
