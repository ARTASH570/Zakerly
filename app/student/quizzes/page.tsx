'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import DashboardShell, { NavItem } from '@/components/dashboard/DashboardShell'
import { HomeIcon, BookIcon, UsersIcon, AwardIcon, ChatIcon } from '@/components/dashboard/icons'

const NAV_ITEMS: NavItem[] = [
  { href: '/student/dashboard', label: 'الرئيسية', icon: <HomeIcon /> },
  { href: '/student/courses', label: 'كورساتي', icon: <BookIcon /> },
  { href: '/student/quizzes', label: 'الكويزات', icon: <AwardIcon /> },
  { href: '/student/teachers', label: 'اختار معلم', icon: <UsersIcon /> },
  { href: '/student/grades', label: 'درجاتي', icon: <AwardIcon /> },
  { href: '/student/messages', label: 'الرسائل', icon: <ChatIcon /> },
]

interface Quiz {
  id: string
  title: string
  description: string | null
  max_attempts: number
  courses: { title: string } | null
}

interface AttemptSummary {
  quiz_id: string
  score: number | null
  max_score: number | null
  submitted_at: string | null
}

export default function StudentQuizzesPage() {
  const router = useRouter()
  const [studentName, setStudentName] = useState('')
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [attempts, setAttempts] = useState<AttemptSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/login/student')
      return
    }
    const studentId = userData.user.id

    const { data: studentRow } = await supabase
      .from('students')
      .select('full_name')
      .eq('id', studentId)
      .single()
    setStudentName(studentRow?.full_name || '')

    const { data: quizzesData } = await supabase
      .from('quizzes')
      .select('id, title, description, max_attempts, courses(title)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
    setQuizzes((quizzesData as unknown as Quiz[]) || [])

    const { data: attemptsData } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, score, max_score, submitted_at')
      .eq('student_id', studentId)
      .not('submitted_at', 'is', null)
    setAttempts(attemptsData || [])

    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  function bestAttempt(quizId: string) {
    const list = attempts.filter((a) => a.quiz_id === quizId)
    if (list.length === 0) return null
    return list.reduce((best, a) => ((a.score || 0) > (best.score || 0) ? a : best))
  }

  return (
    <DashboardShell navItems={NAV_ITEMS} userName={studentName || 'طالب'} roleLabel="حساب طالب" searchable>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">الكويزات</h1>
        <p className="text-ink/50 text-sm mt-1">اختبر فهمك للدروس وشوف نتيجتك فورًا</p>
      </div>

      {loading ? (
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      ) : quizzes.length === 0 ? (
        <div className="bg-paper border border-ink/10 rounded-2xl p-8 text-center">
          <p className="text-ink/50">مفيش كويزات متاحة دلوقتي</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {quizzes.map((q) => {
            const best = bestAttempt(q.id)
            const attemptCount = attempts.filter((a) => a.quiz_id === q.id).length
            return (
              <Link
                key={q.id}
                href={`/student/quizzes/${q.id}`}
                className="bg-paper border border-ink/10 rounded-2xl p-5 hover:border-gold/60 transition-colors"
              >
                <p className="text-ink/40 text-xs mb-1">{q.courses?.title}</p>
                <h3 className="font-display font-bold mb-2">{q.title}</h3>
                {best ? (
                  <p className="text-sm text-gold font-bold">
                    أفضل نتيجة: {best.score}/{best.max_score}
                  </p>
                ) : (
                  <p className="text-sm text-ink/50">لسه مخدتش الكويز ده</p>
                )}
                <p className="text-ink/40 text-xs mt-2">
                  {attemptCount}/{q.max_attempts} محاولات
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </DashboardShell>
  )
}
