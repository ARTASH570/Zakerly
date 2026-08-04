'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

interface Option {
  id: string
  option_text: string
}

interface Question {
  id: string
  question_text: string
  question_type: 'mcq' | 'true_false'
  points: number
  quiz_options: Option[]
}

interface QuizData {
  quiz: { id: string; title: string; description: string | null; max_attempts: number }
  questions: Question[]
  attemptsUsed: number
  attemptsRemaining: number
  openAttempt: { id: string } | null
  pastAttempts: { id: string; score: number | null; max_score: number | null; submitted_at: string | null }[]
}

interface ReviewItem {
  questionId: string
  isCorrect: boolean
  pointsEarned: number
  selectedOptionId: string | null
  options: { id: string; option_text: string; is_correct: boolean }[]
}

export default function TakeQuizPage() {
  const router = useRouter()
  const params = useParams()
  const quizId = params.id as string

  const [studentName, setStudentName] = useState('')
  const [data, setData] = useState<QuizData | null>(null)
  const [loading, setLoading] = useState(true)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ score: number; maxScore: number; review: ReviewItem[] } | null>(null)

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/login/student')
      return
    }
    const { data: studentRow } = await supabase
      .from('students')
      .select('full_name')
      .eq('id', userData.user.id)
      .single()
    setStudentName(studentRow?.full_name || '')

    const res = await fetch(`/api/student/quizzes/${quizId}`)
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'حصل خطأ')
      setLoading(false)
      return
    }
    setData(json)
    if (json.openAttempt) setAttemptId(json.openAttempt.id)
    setLoading(false)
  }, [router, quizId])

  useEffect(() => {
    load()
  }, [load])

  async function handleStart() {
    setStarting(true)
    setError('')
    try {
      const res = await fetch(`/api/student/quizzes/${quizId}/attempt/start`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'حصل خطأ')
        return
      }
      setAttemptId(json.attemptId)
    } finally {
      setStarting(false)
    }
  }

  async function handleSubmit() {
    if (!attemptId || !data) return
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        answers: data.questions.map((q) => ({
          questionId: q.id,
          selectedOptionId: answers[q.id] || null,
        })),
      }
      const res = await fetch(`/api/student/quizzes/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'حصل خطأ')
        return
      }
      setResult(json)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DashboardShell navItems={NAV_ITEMS} userName={studentName || 'طالب'} roleLabel="حساب طالب" searchable>
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      </DashboardShell>
    )
  }

  if (error && !data) {
    return (
      <DashboardShell navItems={NAV_ITEMS} userName={studentName || 'طالب'} roleLabel="حساب طالب" searchable>
        <p className="text-red-600 text-sm">{error}</p>
        <Link href="/student/quizzes" className="text-gold text-sm underline mt-2 inline-block">
          رجوع للكويزات
        </Link>
      </DashboardShell>
    )
  }

  if (!data) return null

  return (
    <DashboardShell navItems={NAV_ITEMS} userName={studentName || 'طالب'} roleLabel="حساب طالب" searchable>
      <Link href="/student/quizzes" className="text-xs text-ink/40 hover:text-gold">
        ← كل الكويزات
      </Link>
      <h1 className="font-display text-xl font-bold mt-1 mb-6">{data.quiz.title}</h1>

      {result ? (
        <div className="space-y-4">
          <div className="bg-board text-chalk rounded-2xl p-6 text-center">
            <p className="text-chalk/60 text-sm mb-1">نتيجتك</p>
            <p className="font-display text-3xl font-bold">
              {result.score}/{result.maxScore}
            </p>
          </div>

          <div className="space-y-3">
            {data.questions.map((q, i) => {
              const r = result.review.find((rv) => rv.questionId === q.id)
              return (
                <div
                  key={q.id}
                  className={`border rounded-xl p-4 ${
                    r?.isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <p className="font-bold text-sm mb-2">
                    {i + 1}. {q.question_text}
                  </p>
                  <div className="space-y-1">
                    {r?.options.map((o) => (
                      <p
                        key={o.id}
                        className={`text-xs px-3 py-1.5 rounded-lg ${
                          o.is_correct
                            ? 'bg-emerald-100 text-emerald-700 font-bold'
                            : o.id === r.selectedOptionId
                            ? 'bg-red-100 text-red-700 font-bold'
                            : 'text-ink/50'
                        }`}
                      >
                        {o.option_text}
                        {o.is_correct && ' ✓'}
                        {!o.is_correct && o.id === r.selectedOptionId && ' ✗ (اخترته)'}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <Link
            href="/student/quizzes"
            className="inline-block bg-gold text-board font-bold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            رجوع للكويزات
          </Link>
        </div>
      ) : attemptId ? (
        <div className="space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {data.questions.map((q, i) => (
            <div key={q.id} className="bg-paper border border-ink/10 rounded-xl p-4">
              <p className="font-bold text-sm mb-3">
                {i + 1}. {q.question_text}
              </p>
              <div className="space-y-2">
                {q.quiz_options.map((o) => (
                  <label
                    key={o.id}
                    className="flex items-center gap-2 text-sm bg-ink/5 rounded-lg px-3 py-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === o.id}
                      onChange={() => setAnswers({ ...answers, [q.id]: o.id })}
                    />
                    {o.option_text}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gold text-board font-bold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? 'جاري التسليم...' : 'سلّم الإجابات'}
          </button>
        </div>
      ) : (
        <div className="bg-paper border border-ink/10 rounded-2xl p-8 text-center">
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          {data.attemptsRemaining > 0 ? (
            <>
              <p className="text-ink/60 mb-1">{data.questions.length} سؤال</p>
              <p className="text-ink/40 text-xs mb-5">
                محاولاتك المتبقية: {data.attemptsRemaining} من {data.quiz.max_attempts}
              </p>
              <button
                onClick={handleStart}
                disabled={starting}
                className="bg-gold text-board font-bold text-sm px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {starting ? 'جاري البدء...' : 'ابدأ الكويز'}
              </button>
            </>
          ) : (
            <>
              <p className="text-ink/50 mb-4">استنفدت عدد المحاولات المسموح بيها</p>
              {data.pastAttempts.length > 0 && (
                <div className="space-y-2 max-w-xs mx-auto">
                  {data.pastAttempts.map((a) => (
                    <p key={a.id} className="text-sm text-ink/70">
                      {a.score}/{a.max_score}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </DashboardShell>
  )
}
