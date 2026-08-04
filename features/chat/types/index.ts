export type SenderRole = 'teacher' | 'student'

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_role: SenderRole
  body: string
  read_at: string | null
  created_at: string
}

export interface ChatConversation {
  id: string
  teacher_id: string
  student_id: string
  course_id: string | null
  last_message_at: string
  created_at: string
}

// شكل موحّد بنرجعه من API الـ conversations، فيه اسم الطرف التاني جاهز للعرض
export interface ConversationSummary {
  id: string
  otherPartyId: string
  otherPartyName: string
  courseTitle: string | null
  lastMessageAt: string
  lastMessagePreview: string | null
  unreadCount: number
}
