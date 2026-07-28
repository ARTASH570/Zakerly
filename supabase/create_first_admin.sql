-- ⚠️ شغّل الكود ده بعد ما تكون عملت حساب عادي (معلم أو طالب) بإيميلك أولًا
-- عن طريق صفحة التسجيل العادية في الموقع

-- استبدل الإيميل ده بإيميلك الحقيقي اللي عملت بيه الحساب
insert into admins (id, full_name)
select id, 'اسمك هنا'
from auth.users
where email = 'your-email@example.com';
