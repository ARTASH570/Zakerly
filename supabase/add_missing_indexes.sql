-- ============================================
-- إضافة فهارس ناقصة على course_id
-- شغّل الملف ده في Supabase SQL Editor (بعد schema.sql)
-- ============================================
--
-- payments وenrollments عندهم unique constraint على (student_id, course_id)،
-- وده بيعمل index تلقائي بس العمود الرئيسي فيه student_id - يعني أي استعلام
-- بيفلتر بـ course_id لوحده بس (زي "كام طالب مشترك في الكورس ده" في لوحة
-- تحكم المعلم/الأدمن) هيعمل full table scan بدل ما يستخدم index. مش هيبان
-- دلوقتي مع عدد قليل من الصفوف، بس هيبطأ مع نمو المشروع.

create index if not exists payments_course_id_idx on payments(course_id);
create index if not exists enrollments_course_id_idx on enrollments(course_id);
