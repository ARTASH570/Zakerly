'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

interface Evaluation {
  id: string
  course_id: string
  attendance_status: 'present' | 'absent' | null
  grade: number | null
  note: string | null
  evaluated_at: string
  courses: { title: string } | null
}

interface QuizAttempt {
  id: string
  score: number | null
  max_score: number | null
  submitted_at: string
  quizzes: { id: string; title: string; courses: { title: string } | null } | null
}

export default function StudentGradesPage() {
  const router = useRouter()
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login/student')
        return
      }

      const { data } = await supabase
        .from('student_evaluations')
        .select('id, course_id, attendance_status, grade, note, evaluated_at, courses(title)')
        .eq('student_id', userData.user.id)
        .order('evaluated_at', { ascending: false })

      setEvaluations((data as unknown as Evaluation[]) || [])

      const { data: attemptsData } = await supabase
        .from('quiz_attempts')
        .select('id, score, max_score, submitted_at, quizzes(id, title, courses(title))')
        .eq('student_id', userData.user.id)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })

      setQuizAttempts((attemptsData as unknown as QuizAttempt[]) || [])

      setLoading(false)
    }
    load()
  }, [router])

  // نجمّع الدرجات حسب الكورس عشان نعرض متوسط لكل كورس
  const byCourse = evaluations.reduce<Record<string, { title: string; items: Evaluation[] }>>(
    (acc, ev) => {
      const key = ev.course_id
      if (!acc[key]) acc[key] = { title: ev.courses?.title || '', items: [] }
      acc[key].items.push(ev)
      return acc
    },
    {}
  )

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl font-bold">درجاتي</h1>
          <Link href="/student/dashboard" className="text-chalk/60 text-sm hover:text-gold">
            رجوع للداشبورد
          </Link>
        </div>

        {loading && <p className="text-chalk/50">جاري التحميل...</p>}

        {!loading && Object.keys(byCourse).length === 0 && quizAttempts.length === 0 && (
          <p className="text-chalk/50 text-sm">مفيش درجات أو تقييمات مسجلة لسه</p>
        )}

        {!loading && quizAttempts.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display font-bold mb-3">نتايج الكويزات</h2>
            <div className="bg-boardLight border border-line rounded-xl divide-y divide-line/50">
              {quizAttempts.map((a) => (
                <Link
                  key={a.id}
                  href={a.quizzes ? `/student/quizzes/${a.quizzes.id}` : '#'}
                  className="flex items-center justify-between px-5 py-3 hover:bg-board/30 transition-colors"
                >
                  <div>
                    <p className="font-bold text-sm">{a.quizzes?.title || 'كويز محذوف'}</p>
                    <p className="text-chalk/40 text-xs mt-0.5">
                      {a.quizzes?.courses?.title} · {new Date(a.submitted_at).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                  <span className="text-gold font-bold text-sm shrink-0">
                    {a.score}/{a.max_score}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(byCourse).map(([courseId, { title, items }]) => {
            const grades = items.filter((i) => i.grade !== null).map((i) => i.grade as number)
            const avg = grades.length > 0 ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1) : null
            const present = items.filter((i) => i.attendance_status === 'present').length
            const absent = items.filter((i) => i.attendance_status === 'absent').length

            return (
              <div key={courseId} className="bg-boardLight border border-line rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold">{title}</h3>
                  {avg && <span className="text-gold font-bold text-sm">متوسط: {avg}</span>}
                </div>

                <p className="text-chalk/50 text-xs mb-4">
                  الحضور: {present} · الغياب: {absent}
                </p>

                <div className="space-y-2">
                  {items.map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between border-b border-line/50 pb-2">
                      <div>
                        <span
                          className={`text-xs ${
                            ev.attendance_status === 'present' ? 'text-gold' : 'text-red-400'
                          }`}
                        >
                          {ev.attendance_status === 'present' ? 'حاضر' : 'غايب'}
                        </span>
                        {ev.note && <p className="text-chalk/50 text-xs mt-1">{ev.note}</p>}
                      </div>
                      <div className="text-left">
                        {ev.grade !== null && <p className="text-chalk font-bold text-sm">{ev.grade}</p>}
                        <p className="text-chalk/30 text-xs">
                          {new Date(ev.evaluated_at).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
