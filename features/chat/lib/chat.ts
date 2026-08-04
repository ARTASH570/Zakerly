import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ChatMessage, ConversationSummary, SenderRole } from '@/features/chat/types'

const MAX_MESSAGE_LENGTH = 2000

/**
 * بيتأكد إن المعلم والطالب مرتبطين فعلاً (الطالب مشترك في كورس من كورسات المعلم ده)
 * قبل ما نسمح بفتح محادثة بينهم. ده تحقق تطبيقي إضافي فوق سياسات RLS الموجودة
 * في قاعدة البيانات، عشان الرسالة اللي بترجع للمستخدم تبقى واضحة.
 */
async function areLinkedByEnrollment(teacherId: string, studentId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('enrollments')
    .select('id, courses!inner(teacher_id)')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .eq('courses.teacher_id', teacherId)
    .limit(1)

  if (error) {
    console.error('areLinkedByEnrollment error:', error)
    return false
  }
  return !!data && data.length > 0
}

/**
 * بيرجع المحادثة لو موجودة، ولو مش موجودة بيعمل واحدة جديدة.
 * برضو بيتأكد الأول إن فيه اشتراك فعلي بين الطرفين.
 */
export async function getOrCreateConversation(
  teacherId: string,
  studentId: string,
  courseId?: string
): Promise<{ conversationId: string } | { error: string; status: number }> {
  const linked = await areLinkedByEnrollment(teacherId, studentId)
  if (!linked) {
    return { error: 'مفيش اشتراك فعلي يربط بينكم، مينفعش تفتح محادثة', status: 403 }
  }

  const { data: existing } = await supabaseAdmin
    .from('chat_conversations')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (existing) {
    return { conversationId: existing.id }
  }

  const { data: created, error } = await supabaseAdmin
    .from('chat_conversations')
    .insert({ teacher_id: teacherId, student_id: studentId, course_id: courseId ?? null })
    .select('id')
    .single()

  if (error || !created) {
    console.error('getOrCreateConversation insert error:', error)
    return { error: 'حصل خطأ في فتح المحادثة', status: 500 }
  }

  return { conversationId: created.id }
}

/**
 * بيتأكد إن المستخدم ده فعلاً طرف في المحادثة دي قبل أي عملية (قراءة/إرسال)
 */
async function getConversationIfParticipant(conversationId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('chat_conversations')
    .select('id, teacher_id, student_id, course_id')
    .eq('id', conversationId)
    .maybeSingle()

  if (!data) return null
  if (data.teacher_id !== userId && data.student_id !== userId) return null
  return data
}

export async function fetchMessages(
  conversationId: string,
  userId: string,
  limit = 50
): Promise<{ messages: ChatMessage[] } | { error: string; status: number }> {
  const conversation = await getConversationIfParticipant(conversationId, userId)
  if (!conversation) {
    return { error: 'المحادثة دي مش موجودة أو مش متاحة ليك', status: 404 }
  }

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('fetchMessages error:', error)
    return { error: 'حصل خطأ في تحميل الرسائل', status: 500 }
  }

  return { messages: data as ChatMessage[] }
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  senderRole: SenderRole,
  body: string
): Promise<{ message: ChatMessage } | { error: string; status: number }> {
  const trimmed = body.trim()
  if (!trimmed) {
    return { error: 'الرسالة متقدرش تكون فاضية', status: 400 }
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { error: `الرسالة طويلة أوي (الحد الأقصى ${MAX_MESSAGE_LENGTH} حرف)`, status: 400 }
  }

  const conversation = await getConversationIfParticipant(conversationId, userId)
  if (!conversation) {
    return { error: 'المحادثة دي مش موجودة أو مش متاحة ليك', status: 404 }
  }

  const expectedRole: SenderRole = conversation.teacher_id === userId ? 'teacher' : 'student'
  if (expectedRole !== senderRole) {
    return { error: 'دورك مش متطابق مع المحادثة دي', status: 403 }
  }

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      sender_role: senderRole,
      body: trimmed,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('sendMessage insert error:', error)
    return { error: 'حصل خطأ في إرسال الرسالة', status: 500 }
  }

  await supabaseAdmin
    .from('chat_conversations')
    .update({ last_message_at: data.created_at })
    .eq('id', conversationId)

  return { message: data as ChatMessage }
}

export async function markMessagesRead(conversationId: string, userId: string): Promise<void> {
  const conversation = await getConversationIfParticipant(conversationId, userId)
  if (!conversation) return

  const recipientRole: SenderRole = conversation.teacher_id === userId ? 'student' : 'teacher'

  await supabaseAdmin
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('sender_role', recipientRole)
    .is('read_at', null)
}

/**
 * بيرجع كل محادثات مستخدم معين (معلم أو طالب) مع اسم الطرف التاني وآخر رسالة،
 * جاهزة للعرض في قايمة المحادثات.
 */
export async function listConversations(
  userId: string,
  role: SenderRole
): Promise<{ conversations: ConversationSummary[] } | { error: string; status: number }> {
  const ownColumn = role === 'teacher' ? 'teacher_id' : 'student_id'
  const otherColumn = role === 'teacher' ? 'student_id' : 'teacher_id'
  const otherTable = role === 'teacher' ? 'students' : 'teachers'

  const { data: conversations, error } = await supabaseAdmin
    .from('chat_conversations')
    .select('id, teacher_id, student_id, course_id, last_message_at')
    .eq(ownColumn, userId)
    .order('last_message_at', { ascending: false })

  if (error) {
    console.error('listConversations error:', error)
    return { error: 'حصل خطأ في تحميل المحادثات', status: 500 }
  }
  if (!conversations || conversations.length === 0) {
    return { conversations: [] }
  }

  const otherIds = conversations.map((c) => (c as any)[otherColumn] as string)
  const courseIds = conversations.map((c) => c.course_id).filter(Boolean) as string[]

  const [{ data: otherParties }, { data: courses }, { data: lastMessages }, { data: unread }] =
    await Promise.all([
      supabaseAdmin.from(otherTable).select('id, full_name').in('id', otherIds),
      courseIds.length
        ? supabaseAdmin.from('courses').select('id, title').in('id', courseIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      supabaseAdmin
        .from('chat_messages')
        .select('conversation_id, body, created_at')
        .in(
          'conversation_id',
          conversations.map((c) => c.id)
        )
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('chat_messages')
        .select('conversation_id')
        .in(
          'conversation_id',
          conversations.map((c) => c.id)
        )
        .eq('sender_role', role === 'teacher' ? 'student' : 'teacher')
        .is('read_at', null),
    ])

  const otherPartyMap = new Map((otherParties ?? []).map((p: any) => [p.id, p.full_name]))
  const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c.title]))
  const lastMessageMap = new Map<string, { body: string; created_at: string }>()
  for (const m of lastMessages ?? []) {
    if (!lastMessageMap.has(m.conversation_id)) {
      lastMessageMap.set(m.conversation_id, { body: m.body, created_at: m.created_at })
    }
  }
  const unreadCountMap = new Map<string, number>()
  for (const u of unread ?? []) {
    unreadCountMap.set(u.conversation_id, (unreadCountMap.get(u.conversation_id) ?? 0) + 1)
  }

  const result: ConversationSummary[] = conversations.map((c) => {
    const otherPartyId = (c as any)[otherColumn] as string
    const lastMessage = lastMessageMap.get(c.id)
    return {
      id: c.id,
      otherPartyId,
      otherPartyName: otherPartyMap.get(otherPartyId) ?? 'مستخدم',
      courseTitle: c.course_id ? courseMap.get(c.course_id) ?? null : null,
      lastMessageAt: lastMessage?.created_at ?? c.last_message_at,
      lastMessagePreview: lastMessage?.body ?? null,
      unreadCount: unreadCountMap.get(c.id) ?? 0,
    }
  })

  return { conversations: result }
}
