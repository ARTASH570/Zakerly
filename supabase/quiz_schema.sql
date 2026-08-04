-- ============================================
-- Elmodares - نظام الكويزات
-- شغّل الملف ده في Supabase SQL Editor بعد schema.sql
-- ============================================

-- الكويز نفسه: مرتبط بكورس، واختياريًا بفيديو معين (يظهر بعد ما الطالب يخلص الفيديو ده)
create table quizzes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  video_id uuid references videos(id) on delete set null, -- null يعني كويز عام على الكورس كله
  title text not null,
  description text,
  is_published boolean default false not null, -- المعلم يجهزه الأول وينشره بعدين
  time_limit_seconds int, -- null يعني بلا وقت محدد
  max_attempts int default 1 not null,
  ai_generated boolean default false not null, -- علشان نعرف الأسئلة دي اتعملت بالـ AI ولا لأ (للإحصائيات بس)
  created_at timestamptz default now()
);

create index quizzes_course_id_idx on quizzes(course_id);
create index quizzes_teacher_id_idx on quizzes(teacher_id);
create index quizzes_video_id_idx on quizzes(video_id);

-- الأسئلة
create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade not null,
  question_text text not null,
  question_type text not null check (question_type in ('mcq', 'true_false')),
  points numeric(6,2) default 1 not null check (points > 0),
  order_index int default 0,
  created_at timestamptz default now()
);

create index quiz_questions_quiz_id_idx on quiz_questions(quiz_id);

-- اختيارات كل سؤال (للـ mcq بيبقى فيه أكتر من اختيار، للـ true_false بيبقى فيهم اتنين بس)
create table quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references quiz_questions(id) on delete cascade not null,
  option_text text not null,
  is_correct boolean default false not null,
  order_index int default 0
);

create index quiz_options_question_id_idx on quiz_options(question_id);

-- محاولة الطالب (بيسمحله بأكتر من محاولة حسب max_attempts)
create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  started_at timestamptz default now(),
  submitted_at timestamptz,
  score numeric(6,2),
  max_score numeric(6,2)
);

create index quiz_attempts_quiz_id_idx on quiz_attempts(quiz_id);
create index quiz_attempts_student_id_idx on quiz_attempts(student_id);

-- إجابة الطالب لكل سؤال في المحاولة
create table quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references quiz_attempts(id) on delete cascade not null,
  question_id uuid references quiz_questions(id) on delete cascade not null,
  selected_option_id uuid references quiz_options(id) on delete set null,
  is_correct boolean,
  points_earned numeric(6,2) default 0,
  unique(attempt_id, question_id)
);

create index quiz_answers_attempt_id_idx on quiz_answers(attempt_id);

-- ============================================
-- Row Level Security
-- ============================================

alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_options enable row level security;
alter table quiz_attempts enable row level security;
alter table quiz_answers enable row level security;

-- المعلم يدير كويزاته بالكامل
create policy "quizzes_teacher_all" on quizzes for all using (auth.uid() = teacher_id);

-- الطالب يشوف الكويزات المنشورة بس في كورسات هو مشترك فيها فعليًا
create policy "quizzes_student_select" on quizzes for select using (
  is_published = true
  and exists (
    select 1 from enrollments e
    where e.course_id = quizzes.course_id
    and e.student_id = auth.uid()
    and e.is_active = true
  )
);

-- الأسئلة والاختيارات: المعلم بس عنده وصول مباشر (عبر ملكية الكويز)
-- ⚠️ الطالب مالوش أي policy select هنا عن قصد - لو قرا الاختيارات مباشرة
-- هيشوف عمود is_correct وده بيكشفله الإجابة الصح قبل ما يحل! الطالب بياخد
-- الأسئلة والاختيارات (من غير عمود is_correct) عن طريق API route بالـ service role.
create policy "quiz_questions_teacher_all" on quiz_questions for all using (
  exists (select 1 from quizzes q where q.id = quiz_questions.quiz_id and q.teacher_id = auth.uid())
);

create policy "quiz_options_teacher_all" on quiz_options for all using (
  exists (
    select 1 from quiz_questions qq
    join quizzes q on q.id = qq.quiz_id
    where qq.id = quiz_options.question_id and q.teacher_id = auth.uid()
  )
);

-- المحاولات: كل طرف يشوف بتاعه بس. الإنشاء والتصحيح بيحصلوا عن طريق API
-- بالـ service role (مش مباشر من المتصفح) عشان نمنع الطالب يبعت درجة مزورة لنفسه.
create policy "quiz_attempts_student_select" on quiz_attempts for select using (auth.uid() = student_id);
create policy "quiz_attempts_teacher_select" on quiz_attempts for select using (
  exists (select 1 from quizzes q where q.id = quiz_attempts.quiz_id and q.teacher_id = auth.uid())
);

create policy "quiz_answers_student_select" on quiz_answers for select using (
  exists (select 1 from quiz_attempts a where a.id = quiz_answers.attempt_id and a.student_id = auth.uid())
);
create policy "quiz_answers_teacher_select" on quiz_answers for select using (
  exists (
    select 1 from quiz_attempts a
    join quizzes q on q.id = a.quiz_id
    where a.id = quiz_answers.attempt_id and q.teacher_id = auth.uid()
  )
);
