-- ============================================
-- Elmodares - مخطط قاعدة البيانات الأساسي
-- شغّل الملف ده في Supabase SQL Editor
-- ============================================

-- جدول المعلمين
create table teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  subject text, -- المادة اللي بيدرّسها
  bio text,
  phone text,
  subscription_status text default 'trial' check (subscription_status in ('trial', 'active', 'expired')),
  trial_ends_at timestamptz default (now() + interval '30 days'),
  created_at timestamptz default now()
);

-- جدول الطلاب
create table students (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  parent_phone text, -- رقم ولي الأمر لإرسال التقارير
  grade_level text, -- الصف الدراسي
  created_at timestamptz default now()
);

-- جدول الكورسات (كل معلم عنده كورس أو أكتر)
create table courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade not null,
  title text not null,
  description text,
  price numeric(10,2) not null, -- السعر بالجنيه
  is_published boolean default false,
  publish_at timestamptz, -- لو محدد، الكورس مايظهرش للطلاب إلا لما يجي الموعيد ده
  unpublish_at timestamptz, -- لو محدد، الكورس بيختفي تلقائيًا من الطلاب بعد الموعيد ده
  created_at timestamptz default now()
);

-- جدول الفيديوهات (كل فيديو مرتبط بكورس ومرفوع على Bunny Stream)
create table videos (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  title text not null,
  bunny_video_id text not null, -- الـ GUID بتاع الفيديو على Bunny Stream
  duration_seconds int,
  order_index int default 0,
  created_at timestamptz default now()
);

-- جدول الاشتراكات (الطالب اللي دفع لكورس معين)
create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  payment_id uuid, -- يتربط بجدول المدفوعات
  is_active boolean default true,
  enrolled_at timestamptz default now(),
  unique(student_id, course_id)
);

-- جدول المدفوعات (سجل كل عملية دفع من Paymob أو Stripe)
create table payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  amount numeric(10,2) not null,
  original_amount numeric(10,2), -- السعر الأصلي قبل أي خصم كوبون (null لو مفيش كوبون اتستخدم)
  coupon_id uuid, -- ⚠️ الـ Foreign Key بتاعه بيتضاف بعدين تحت (ALTER TABLE) بعد ما جدول coupons يتعمل،
                  -- عشان نتفادى مشكلة "جدول coupons مش موجود لسه" وقت تنفيذ السكريبت بالترتيب
  provider text not null check (provider in ('paymob', 'stripe', 'paypal')),
  provider_transaction_id text,
  status text default 'pending' check (status in ('pending', 'success', 'failed')),
  created_at timestamptz default now()
);

-- جدول تقييم/متابعة الطلاب (درجات وحضور)
create table student_evaluations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  attendance_status text check (attendance_status in ('present', 'absent')),
  grade numeric(5,2),
  note text,
  evaluated_at timestamptz default now()
);

-- ============================================
-- Row Level Security (مهم جدًا: كل معلم يشوف بياناته بس، كل طالب يشوف بياناته بس)
-- ============================================

alter table teachers enable row level security;
alter table students enable row level security;
alter table courses enable row level security;
alter table videos enable row level security;
alter table enrollments enable row level security;
alter table payments enable row level security;
alter table student_evaluations enable row level security;

-- المعلم يشوف ويعدل بياناته بس
create policy "teachers_select_own" on teachers for select using (auth.uid() = id);
create policy "teachers_update_own" on teachers for update using (auth.uid() = id);
-- 🔴 ضرورية: من غيرها التسجيل نفسه بيفشل لأن الـ RLS بيرفض أي INSERT بدون سياسة صريحة
create policy "teachers_insert_own" on teachers for insert with check (auth.uid() = id);

-- ⚠️ ملحوظة أمان مهمة: تعمّدنا عدم عمل policy عامة (public) على جدول teachers نفسه.
-- لو عملنا "for select using (كورس منشور)" هيسمح لأي حد يقرأ الصف كامل بما فيه
-- رقم التليفون وحالة الاشتراك (RLS بيشتغل على مستوى الصف مش العمود). بدل كده،
-- بننشئ View بيعرض الأعمدة الآمنة بس، وده اللي المفروض صفحات تصفح المعلمين تستخدمه.
create view public_teacher_profiles as
select id, full_name, subject, bio
from teachers
where exists (
  select 1 from courses where courses.teacher_id = teachers.id and courses.is_published = true
);

grant select on public_teacher_profiles to anon, authenticated;

-- الطالب يشوف بياناته بس
create policy "students_select_own" on students for select using (auth.uid() = id);
create policy "students_update_own" on students for update using (auth.uid() = id);
-- 🔴 ضرورية: نفس السبب - من غيرها تسجيل الطالب بيفشل
create policy "students_insert_own" on students for insert with check (auth.uid() = id);

-- المعلم يدير كورساته بس
create policy "courses_teacher_all" on courses for all using (auth.uid() = teacher_id);
-- أي حد يقدر يشوف الكورسات المنشورة فعليًا الآن (مع مراعاة مواعيد الجدولة لو موجودة)
create policy "courses_public_select" on courses for select using (
  is_published = true
  and (publish_at is null or publish_at <= now())
  and (unpublish_at is null or unpublish_at > now())
);

-- الفيديوهات: المعلم يدير فيديوهات كورساته، والطالب المشترك يشوفها بس
create policy "videos_teacher_all" on videos for all using (
  exists (select 1 from courses where courses.id = videos.course_id and courses.teacher_id = auth.uid())
);
create policy "videos_enrolled_student_select" on videos for select using (
  exists (
    select 1 from enrollments
    where enrollments.course_id = videos.course_id
    and enrollments.student_id = auth.uid()
    and enrollments.is_active = true
  )
);

-- الاشتراكات: الطالب يشوف اشتراكاته، المعلم يشوف مين مشترك في كورساته
create policy "enrollments_student_select" on enrollments for select using (auth.uid() = student_id);
create policy "enrollments_teacher_select" on enrollments for select using (
  exists (select 1 from courses where courses.id = enrollments.course_id and courses.teacher_id = auth.uid())
);

-- المدفوعات: نفس المنطق
create policy "payments_student_select" on payments for select using (auth.uid() = student_id);
create policy "payments_teacher_select" on payments for select using (
  exists (select 1 from courses where courses.id = payments.course_id and courses.teacher_id = auth.uid())
);

-- التقييمات: المعلم يدير تقييمات طلابه، الطالب يشوف تقييماته بس
create policy "evaluations_teacher_all" on student_evaluations for all using (
  exists (select 1 from courses where courses.id = student_evaluations.course_id and courses.teacher_id = auth.uid())
);
create policy "evaluations_student_select" on student_evaluations for select using (auth.uid() = student_id);

-- ============================================
-- سجل النشاط (Activity Log)
-- ============================================

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_role text check (user_role in ('teacher', 'student', 'system')),
  action text not null, -- مثلاً: 'login', 'course.create', 'payment.success'
  entity_type text, -- مثلاً: 'course', 'video', 'payment'
  entity_id text,
  metadata jsonb default '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

-- فهرسة عشان لو حبيت بعدين تعمل شاشة "سجل النشاط" وتفلتر بسرعة
create index activity_logs_user_id_idx on activity_logs(user_id);
create index activity_logs_action_idx on activity_logs(action);
create index activity_logs_created_at_idx on activity_logs(created_at desc);

alter table activity_logs enable row level security;

-- ⚠️ تعمّدنا عدم عمل أي policy تسمح بالقراءة أو الكتابة من المتصفح خالص.
-- السجل ده بيتكتب بس من السيرفر (service role بيتخطى RLS تلقائيًا)،
-- وده صحيح أمنيًا: لو معلم قدر يمسح أو يعدل سجل نشاطه، بقى السجل عديم الفايدة.
-- لو حبيت بعدين تعمل شاشة "Activity Log" لنفسك كـ admin، هتحتاج تعمل جدول
-- admins منفصل وpolicy خاصة بيه، مش تفتحه للمعلمين/الطلاب العاديين.

-- ============================================
-- تتبع مشاهدة الفيديو (Video Views)
-- ============================================

-- صف واحد بس لكل (طالب + فيديو) - بيتحدث باستمرار أثناء المشاهدة (مش صف جديد كل مرة)
create table video_views (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  video_id uuid references videos(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  max_position_seconds numeric(10,2) default 0, -- أبعد نقطة وصلها الطالب فعليًا (مش آخر نقطة بس، عشان لو رجع لورا)
  duration_seconds numeric(10,2),
  completed boolean default false, -- true لو وصل لـ 90% أو أكتر من الفيديو
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(student_id, video_id)
);

create index video_views_video_id_idx on video_views(video_id);
create index video_views_course_id_idx on video_views(course_id);

alter table video_views enable row level security;

-- الطالب يشوف بيانات مشاهدته بس
create policy "video_views_student_select" on video_views for select using (auth.uid() = student_id);
-- المعلم يشوف إحصائيات المشاهدة لفيديوهات كورساته بس
create policy "video_views_teacher_select" on video_views for select using (
  exists (select 1 from courses where courses.id = video_views.course_id and courses.teacher_id = auth.uid())
);
-- ⚠️ مفيش policy للـ insert/update خالص - الكتابة بتحصل من route السيرفر
-- بس (service role) بعد ما يتأكد إن الطالب فعلاً مشترك في الكورس ده

-- ============================================
-- هيكل الأقسام (Sections) - إضافة غير كاسرة فوق الفيديوهات الموجودة
-- course_id بيفضل موجود على videos زي ما هو (كل الـ RLS والتحليلات شغالين عليه)
-- section_id بيتضاف كطبقة تنظيم إضافية بس، مش بديل
-- ============================================

create table sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  title text not null,
  order_index int default 0,
  created_at timestamptz default now()
);

-- ضروري عشان الـ Composite Foreign Key تحت يشتغل: لازم unique constraint
-- على (id, course_id) مش بس على id لوحده
alter table sections add constraint sections_id_course_id_key unique (id, course_id);

create index sections_course_id_idx on sections(course_id);

alter table sections enable row level security;

create policy "sections_teacher_all" on sections for all using (
  exists (select 1 from courses where courses.id = sections.course_id and courses.teacher_id = auth.uid())
);
create policy "sections_enrolled_student_select" on sections for select using (
  exists (
    select 1 from enrollments
    where enrollments.course_id = sections.course_id
    and enrollments.student_id = auth.uid()
    and enrollments.is_active = true
  )
);

-- عمود section_id على الفيديو - اختياري (nullable) عشان الفيديوهات القديمة تفضل شغالة
alter table videos add column section_id uuid;

-- فهارس: section_id جديد، وcourse_id (كان ناقص من الأول رغم إنه بيتفلتر بيه
-- في كل مكان تقريبًا - RLS، التحليلات، تتبع المشاهدة - كسب إضافي بنصلحه دلوقتي)
create index videos_section_id_idx on videos(section_id);
create index videos_course_id_idx on videos(course_id);

-- ⚠️ Composite Foreign Key: الضمان الحقيقي إن section_id وcourse_id ميتعارضوش.
-- قاعدة البيانات نفسها بترفض أي صف فيديو يحاول يشاور على قسم من كورس مختلف
-- عن course_id بتاعه، مهما كان مصدر الطلب - حتى لو غلطة في الكود.
--
-- سلوك الحذف: ON DELETE SET NULL (section_id) بس - لو القسم اتمسح، الفيديو
-- مبيتمسحش، بس يبقى "بدون قسم" (section_id = null) ويفضل موجود تحت الكورس.
-- ⚠️ الصيغة دي (SET NULL على عمود محدد) متاحة من Postgres 15+. Supabase
-- الحديث شغال بيها عادي، لو مشروعك على نسخة أقدم، استبدلها بـ trigger بديل.
alter table videos
  add constraint videos_section_course_fk
  foreign key (section_id, course_id)
  references sections(id, course_id)
  on delete set null (section_id);

-- ============================================
-- هجرة البيانات القديمة - جوه Transaction واحدة صريحة (كلها بتنجح مع بعض أو ولا حاجة بيتنفذ)
-- ============================================

begin;

do $$
declare
  c record;
  new_section_id uuid;
begin
  for c in select distinct course_id from videos where section_id is null loop
    insert into sections (course_id, title, order_index)
    values (c.course_id, 'القسم الأول', 0)
    returning id into new_section_id;

    update videos set section_id = new_section_id
    where course_id = c.course_id and section_id is null;
  end loop;
end $$;

commit;

-- ============================================
-- دوال لإعادة الترتيب بشكل Atomic - بتستبدل الطريقة القديمة اللي كانت بتعمل
-- N تحديثات منفصلة من غير ضمان إنهم كلهم ينجحوا مع بعض أو يفشلوا مع بعض
-- ============================================

create or replace function reorder_videos(p_video_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update videos
  set order_index = t.ordinality - 1
  from unnest(p_video_ids) with ordinality as t(video_id, ordinality)
  where videos.id = t.video_id;
$$;

create or replace function reorder_sections(p_section_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update sections
  set order_index = t.ordinality - 1
  from unnest(p_section_ids) with ordinality as t(section_id, ordinality)
  where sections.id = t.section_id;
$$;

-- ============================================
-- الأدمن
-- ============================================

create table admins (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz default now()
);

alter table admins enable row level security;
create policy "admins_select_own" on admins for select using (auth.uid() = id);

-- تعطيل الحسابات - إضافة غير كاسرة (default false، مفيش تأثير على أي حساب موجود)
alter table teachers add column is_disabled boolean default false not null;
alter table students add column is_disabled boolean default false not null;

-- توسيع حالة الدفع لتشمل "مستردة"
alter table payments drop constraint if exists payments_status_check;
alter table payments add constraint payments_status_check
  check (status in ('pending', 'success', 'failed', 'refunded'));

-- الأدمن يشوف كل حاجة - سياسات صريحة بدل ما نعتمد على service role بس
-- (بيسهّل مستقبلًا لو حبيت تعمل استعلامات مباشرة من لوحة الأدمن بمفتاح anon)
create policy "admins_full_access_teachers" on teachers for select using (
  exists (select 1 from admins where admins.id = auth.uid())
);
create policy "admins_full_access_students" on students for select using (
  exists (select 1 from admins where admins.id = auth.uid())
);
create policy "admins_full_access_payments" on payments for select using (
  exists (select 1 from admins where admins.id = auth.uid())
);
create policy "admins_full_access_activity_logs" on activity_logs for select using (
  exists (select 1 from admins where admins.id = auth.uid())
);

-- ============================================
-- نظام الكوبونات (Coupons)
-- ============================================

create table coupons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade not null,
  code text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  course_id uuid references courses(id) on delete cascade, -- null يعني شغال على كل كورسات المعلم
  min_price numeric(10,2), -- الكوبون ميتفعّلش إلا لو سعر الكورس أكبر من أو يساوي الرقم ده
  usage_limit int, -- null يعني بلا حد
  usage_count int default 0 not null,
  one_time_per_student boolean default true not null,
  expires_at timestamptz,
  is_active boolean default true not null,
  created_at timestamptz default now(),
  unique(teacher_id, code) -- نفس الكود ممكن يتكرر بين معلمين مختلفين، بس مش عند نفس المعلم
);

create index coupons_teacher_id_idx on coupons(teacher_id);
create index coupons_code_idx on coupons(code);

-- دلوقتي جدول coupons موجود، نقدر نضيف الـ FK بتاع payments.coupon_id بأمان
alter table payments
  add constraint payments_coupon_id_fkey
  foreign key (coupon_id) references coupons(id) on delete set null;

-- سجل الاستخدام - بنحتاجه عشان نتحقق من شرط "مرة واحدة لكل طالب" ونعرف مين استخدم الكوبون امتى
create table coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid references coupons(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  payment_id uuid references payments(id) on delete set null,
  redeemed_at timestamptz default now()
);

create index coupon_redemptions_coupon_id_idx on coupon_redemptions(coupon_id);
create index coupon_redemptions_student_id_idx on coupon_redemptions(student_id);

alter table coupons enable row level security;
alter table coupon_redemptions enable row level security;

-- المعلم يدير كوبوناته بس
create policy "coupons_teacher_all" on coupons for all using (auth.uid() = teacher_id);
-- الطالب يقدر "يشوف" كوبون معين بس لو عرف كوده بالظبط (مش تصفح كل الكوبونات) -
-- ده بيحصل فعليًا عن طريق route سيرفر بيتحقق بالـ service role، مش قراءة مباشرة من المتصفح
-- فمفيش داعي لسياسة select عامة هنا خالص، وده الأنسب أمنيًا (الطالب مايشوفش كوبونات المعلمين التانيين)

-- الطالب يشوف سجل استخدامه بس، المعلم يشوف استخدام كوبوناته
create policy "coupon_redemptions_student_select" on coupon_redemptions for select using (auth.uid() = student_id);
create policy "coupon_redemptions_teacher_select" on coupon_redemptions for select using (
  exists (select 1 from coupons where coupons.id = coupon_redemptions.coupon_id and coupons.teacher_id = auth.uid())
);
-- ⚠️ مفيش policy لـ insert خالص - الكتابة بتحصل بس عن طريق دالة redeem_coupon تحت (service role)

-- ============================================
-- دالة استخدام الكوبون - Atomic بالكامل عشان تمنع Race Condition
-- (لو طالبين استخدموا نفس الكوبون في نفس اللحظة والكوبون قرّب يخلص حده)
-- ============================================

create or replace function redeem_coupon(p_coupon_id uuid, p_student_id uuid, p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon coupons%rowtype;
  v_already_used boolean;
begin
  -- FOR UPDATE بيقفل الصف ده لحد ما الـ transaction تخلص، فمفيش طلب تاني
  -- يقدر يقرأ نفس القيمة القديمة ويزوّد العداد في نفس اللحظة (Race Condition)
  select * into v_coupon from coupons where id = p_coupon_id for update;

  if not found or not v_coupon.is_active then
    return false;
  end if;

  if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
    return false;
  end if;

  if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then
    return false;
  end if;

  if v_coupon.one_time_per_student then
    select exists(
      select 1 from coupon_redemptions
      where coupon_id = p_coupon_id and student_id = p_student_id
    ) into v_already_used;

    if v_already_used then
      return false;
    end if;
  end if;

  update coupons set usage_count = usage_count + 1 where id = p_coupon_id;
  insert into coupon_redemptions (coupon_id, student_id, payment_id)
  values (p_coupon_id, p_student_id, p_payment_id);

  return true;
end;
$$;
