'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useConversations } from '@/features/chat/hooks/useConversations'
import ConversationList from '@/features/chat/components/ConversationList'
import ChatWindow from '@/features/chat/components/ChatWindow'

interface EnrolledStudent {
  student_id: string
  full_name: string
}

export default function TeacherMessagesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { conversations, loading, error, reload } = useConversations()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('c'))
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([])
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login?role=teacher')
        return
      }
      setCurrentUserId(userData.user.id)

      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('teacher_id', userData.user.id)

      const courseIds = (courses || []).map((c) => c.id)
      if (courseIds.length === 0) return

      const { data } = await supabase
        .from('enrollments')
        .select('student_id, students(full_name)')
        .in('course_id', courseIds)
        .eq('is_active', true)

      const seen = new Set<string>()
      const students: EnrolledStudent[] = []
      for (const row of (data as any[]) || []) {
        const studentId = row.student_id
        const fullName = row.students?.full_name
        if (studentId && !seen.has(studentId)) {
          seen.add(studentId)
          students.push({ student_id: studentId, full_name: fullName || 'طالب' })
        }
      }
      setEnrolledStudents(students)
    }
    load()
  }, [router])

  async function startConversation(studentId: string) {
    setStarting(true)
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await reload()
      setSelectedId(data.conversationId)
    } catch (err) {
      console.error(err)
    } finally {
      setStarting(false)
    }
  }

  const selectedConversation = conversations.find((c) => c.id === selectedId)
  const studentsWithoutConversation = enrolledStudents.filter(
    (s) => !conversations.some((c) => c.otherPartyId === s.student_id)
  )

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">الرسائل</h1>
        <Link href="/teacher/dashboard" className="text-sm text-chalk/60 hover:text-gold">
          ← رجوع للوحة التحكم
        </Link>
      </div>

      <div className="bg-boardLight border border-line rounded-xl overflow-hidden grid md:grid-cols-3 h-[70vh]">
        <div className="border-l border-line flex flex-col overflow-y-auto">
          {studentsWithoutConversation.length > 0 && (
            <div className="p-3 border-b border-line">
              <p className="text-chalk/40 text-xs mb-2">ابدأ محادثة مع:</p>
              <div className="flex flex-wrap gap-2">
                {studentsWithoutConversation.map((s) => (
                  <button
                    key={s.student_id}
                    disabled={starting}
                    onClick={() => startConversation(s.student_id)}
                    className="text-xs bg-board border border-line rounded-full px-3 py-1 hover:border-gold/50 disabled:opacity-40"
                  >
                    {s.full_name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-red-400 text-sm text-center py-4">{error}</p>}
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading}
          />
        </div>

        <div className="md:col-span-2 flex flex-col">
          {currentUserId && (
            <ChatWindow
              conversationId={selectedId}
              currentUserId={currentUserId}
              otherPartyName={selectedConversation?.otherPartyName ?? ''}
            />
          )}
        </div>
      </div>
    </main>
  )
}
