-- ============================================
-- نظام الباقات (Teacher Packages) + وضع الصيانة (Maintenance Mode)
-- شغّل الملف ده في Supabase SQL Editor بعد باقي ملفات الـ schema
-- ============================================

-- ============================================
-- 1) باقات المعلمين
-- ============================================

create table teacher_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  -- null يعني "بلا حد" (unlimited) - مش صفر
  max_courses int,
  max_students int,
  live_sessions boolean not null default false,
  coupons_enabled boolean not null default true,
  priority_support boolean not null default false,
  is_active boolean not null default true, -- الأدمن يقدر يخفي باقة مؤقتًا من غير ما يمسحها
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3 باقات افتراضية جاهزة - الأدمن يقدر يعدل أسمائها وأسعارها ووصفها وصلاحياتها
-- من لوحة التحكم، مفيش حاجة تانية لازم تتعمل يدوي في الداتابيز
insert into teacher_packages (name, description, price, max_courses, max_students, live_sessions, coupons_enabled, priority_support, sort_order)
values
  ('أساسية', 'مناسبة للمعلم اللي لسه بادئ - كورس أو اتنين وعدد طلاب محدود.', 0, 2, 50, false, false, false, 0),
  ('احترافية', 'كورسات وطلاب أكتر، مع حصص مباشرة وكوبونات خصم.', 299, 10, 500, true, true, false, 1),
  ('بريميوم', 'بلا حدود على الكورسات والطلاب، مع دعم فني بأولوية.', 799, null, null, true, true, true, 2);

alter table teacher_packages enable row level security;

-- أي مستخدم مسجل دخول (معلم بيدوّر على باقة) يقدر يشوف الباقات المفعّلة بس
create policy "packages_public_select" on teacher_packages for select using (is_active = true);
-- الأدمن يشوف كل الباقات حتى غير المفعّلة (عشان يقدر يفعّلها تاني)
create policy "packages_admin_select" on teacher_packages for select using (
  exists (select 1 from admins where admins.id = auth.uid())
);
-- ⚠️ مفيش policy لـ insert/update/delete من المتصفح خالص - التعديل بيحصل بس
-- عن طريق route السيرفر (service role) بعد التحقق من requireAdmin()

-- ============================================
-- 2) اشتراك المعلم في باقة
-- ============================================

create table teacher_subscriptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade not null unique,
  package_id uuid references teacher_packages(id) on delete restrict not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  started_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index teacher_subscriptions_package_id_idx on teacher_subscriptions(package_id);

alter table teacher_subscriptions enable row level security;

-- المعلم يشوف اشتراكه بس
create policy "subscriptions_teacher_select" on teacher_subscriptions for select using (auth.uid() = teacher_id);
-- الأدمن يشوف كل الاشتراكات (عشان يعرف كل باقة فيها كام معلم)
create policy "subscriptions_admin_select" on teacher_subscriptions for select using (
  exists (select 1 from admins where admins.id = auth.uid())
);
-- ⚠️ مفيش policy لـ insert/update من المتصفح - الاشتراك بيتعمل عن طريق
-- route السيرفر بعد التحقق من requireTeacher()، عشان نضمن إن مفيش معلم
-- يقدر يشترك باسم معلم تاني أو يلعب في الحالة (status) مباشرة

-- ============================================
-- 3) إعدادات المنصة العامة + وضع الصيانة
-- ============================================

-- صف واحد بس دايمًا (id boolean + check بيمنع أي صف تاني يتضاف)
create table platform_settings (
  id boolean primary key default true check (id),
  maintenance_mode boolean not null default false,
  maintenance_message text default 'المنصة تحت الصيانة دلوقتي، هنرجعلكم قريب. حاول تاني بعد شوية.',
  updated_at timestamptz default now(),
  updated_by uuid references admins(id) on delete set null
);

insert into platform_settings (id) values (true);

alter table platform_settings enable row level security;

-- ⚠️ policy عامة للقراءة (بدون تسجيل دخول حتى) لأن الـ middleware محتاج
-- يتحقق من حالة الصيانة قبل ما يعرف المستخدم مين أصلًا. البيانات نفسها
-- (هل الصيانة شغالة + رسالة نصية) مفيهاش أي حاجة حساسة تستاهل تتخبى
create policy "platform_settings_public_select" on platform_settings for select using (true);
-- ⚠️ مفيش policy لـ update من المتصفح - التعديل بيحصل بس عن طريق
-- route السيرفر (service role) بعد التحقق من requireAdmin()
