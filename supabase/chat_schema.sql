-- ============================================
-- Elmodares - نظام الشات (معلم ↔ طالب)
-- شغّل الملف ده في Supabase SQL Editor بعد schema.sql
-- ============================================

-- محادثة واحدة بين معلم وطالب معين (بترجع لنفس الصف لو حاولوا يفتحوا واحدة تانية)
create table chat_conversations (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  course_id uuid references courses(id) on delete set null, -- اختياري: أي كورس بدأت المحادثة بمناسبته
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(teacher_id, student_id)
);

create index chat_conversations_teacher_id_idx on chat_conversations(teacher_id);
create index chat_conversations_student_id_idx on chat_conversations(student_id);

-- الرسائل نفسها
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references chat_conversations(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade not null,
  sender_role text not null check (sender_role in ('teacher', 'student')),
  body text not null check (char_length(body) > 0 and char_length(body) <= 2000),
  read_at timestamptz,
  created_at timestamptz default now()
);

create index chat_messages_conversation_id_idx on chat_messages(conversation_id, created_at);

-- ============================================
-- Row Level Security
-- ============================================

alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;

-- كل طرف يشوف المحادثات بتاعته بس
create policy "chat_conversations_teacher_select" on chat_conversations
  for select using (auth.uid() = teacher_id);
create policy "chat_conversations_student_select" on chat_conversations
  for select using (auth.uid() = student_id);

-- المعلم يقدر يبدأ محادثة مع أي طالب مشترك في أي من كورساته
create policy "chat_conversations_teacher_insert" on chat_conversations
  for insert with check (
    auth.uid() = teacher_id
    and exists (
      select 1 from enrollments e
      join courses c on c.id = e.course_id
      where e.student_id = chat_conversations.student_id
      and c.teacher_id = auth.uid()
      and e.is_active = true
    )
  );

-- الطالب يقدر يبدأ محادثة مع معلم هو مشترك في كورس من كورساته
create policy "chat_conversations_student_insert" on chat_conversations
  for insert with check (
    auth.uid() = student_id
    and exists (
      select 1 from enrollments e
      join courses c on c.id = e.course_id
      where e.student_id = auth.uid()
      and c.teacher_id = chat_conversations.teacher_id
      and e.is_active = true
    )
  );

-- قراءة الرسائل: أي طرف في المحادثة (معلم أو طالب) يقدر يشوفها
create policy "chat_messages_participant_select" on chat_messages
  for select using (
    exists (
      select 1 from chat_conversations cc
      where cc.id = chat_messages.conversation_id
      and (cc.teacher_id = auth.uid() or cc.student_id = auth.uid())
    )
  );

-- إرسال رسالة: لازم تكون طرف في المحادثة، وتبعت بهويتك ودورك الحقيقي بس
create policy "chat_messages_participant_insert" on chat_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from chat_conversations cc
      where cc.id = chat_messages.conversation_id
      and (
        (cc.teacher_id = auth.uid() and chat_messages.sender_role = 'teacher')
        or
        (cc.student_id = auth.uid() and chat_messages.sender_role = 'student')
      )
    )
  );

-- تحديد الرسالة كمقروءة: بس الطرف المُستقبِل (مش اللي بعتها) يقدر يعلّمها مقروءة
create policy "chat_messages_recipient_update_read" on chat_messages
  for update using (
    exists (
      select 1 from chat_conversations cc
      where cc.id = chat_messages.conversation_id
      and (
        (cc.teacher_id = auth.uid() and chat_messages.sender_role = 'student')
        or
        (cc.student_id = auth.uid() and chat_messages.sender_role = 'teacher')
      )
    )
  );

-- ============================================
-- تفعيل Realtime على جدول الرسائل (عشان الشات يوصل لحظي من غير تحديث الصفحة)
-- ⚠️ لازم كمان تروح لـ Supabase Dashboard > Database > Replication
-- وتفعّل جدول chat_messages من هناك يدويًا، السطر ده لوحده مش كفاية دايمًا
-- ============================================
alter publication supabase_realtime add table chat_messages;
