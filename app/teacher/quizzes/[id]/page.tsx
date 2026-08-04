'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import DashboardShell, { NavItem } from '@/components/dashboard/DashboardShell'
import { HomeIcon, BookIcon, ChartIcon, TagIcon, ChatIcon, UserIcon, AwardIcon, PackageIcon } from '@/components/dashboard/icons'

const NAV_ITEMS: NavItem[] = [
  { href: '/teacher/dashboard', label: 'الرئيسية', icon: <HomeIcon /> },
  { href: '/teacher/courses', label: 'كورساتي', icon: <BookIcon /> },
  { href: '/teacher/quizzes', label: 'الكويزات', icon: <AwardIcon /> },
  { href: '/teacher/coupons', label: 'الكوبونات', icon: <TagIcon /> },
  { href: '/teacher/packages', label: 'الباقات', icon: <PackageIcon /> },
  { href: '/teacher/messages', label: 'الرسائل', icon: <ChatIcon /> },
  { href: '/teacher/profile', label: 'بياناتي', icon: <UserIcon /> },
]

interface Option {
  id: string
  option_text: string
  is_correct: boolean
}

interface Question {
  id: string
  question_text: string
  question_type: 'mcq' | 'true_false'
  points: number
  quiz_options: Option[]
}

interface Quiz {
  id: string
  title: string
  is_published: boolean
  course_id: string
}

interface AiSuggestion {
  questionText: string
  questionType: 'mcq' | 'true_false'
  options: { text: string; isCorrect: boolean }[]
}

export default function ManageQuizPage() {
  const router = useRouter()
  const params = useParams()
  const quizId = params.id as string

  const [teacherName, setTeacherName] = useState('')
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  // نموذج إضافة سؤال يدوي
  const [qText, setQText] = useState('')
  const [qType, setQType] = useState<'mcq' | 'true_false'>('mcq')
  const [mcqOptions, setMcqOptions] = useState(['', '', '', ''])
  const [correctIndex, setCorrectIndex] = useState(0)
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [formError, setFormError] = useState('')

  // توليد بالـ AI
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [lessonContent, setLessonContent] = useState('')
  const [aiCount, setAiCount] = useState(5)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [selectedSuggestions, setSelectedSuggestions] = useState<boolean[]>([])
  const [savingSuggestions, setSavingSuggestions] = useState(false)

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/login/teacher')
      return
    }

    const { data: teacherRow } = await supabase
      .from('teachers')
      .select('full_name')
      .eq('id', userData.user.id)
      .single()
    setTeacherName(teacherRow?.full_name || '')

    const { data: quizData } = await supabase
      .from('quizzes')
      .select('id, title, is_published, course_id')
      .eq('id', quizId)
      .single()
    setQuiz(quizData)

    const { data: questionsData } = await supabase
      .from('quiz_questions')
      .select('id, question_text, question_type, points, quiz_options(id, option_text, is_correct, order_index)')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true })

    setQuestions(
      ((questionsData as unknown as (Question & { quiz_options: (Option & { order_index: number })[] })[]) || []).map(
        (q) => ({ ...q, quiz_options: q.quiz_options.sort((a, b) => a.order_index - b.order_index) })
      )
    )

    setLoading(false)
  }, [router, quizId])

  useEffect(() => {
    load()
  }, [load])

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!qText.trim()) return

    const options =
      qType === 'mcq'
        ? mcqOptions.map((text, i) => ({ text, isCorrect: i === correctIndex }))
        : [
            { text: 'صح', isCorrect: correctIndex === 0 },
            { text: 'غلط', isCorrect: correctIndex === 1 },
          ]

    if (qType === 'mcq' && options.some((o) => !o.text.trim())) {
      setFormError('لازم تملأ كل الاختيارات الأربعة')
      return
    }

    setSavingQuestion(true)
    try {
      const res = await fetch(`/api/teacher/quizzes/${quizId}/questions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText: qText, questionType: qType, options }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'حصل خطأ')
        return
      }
      setQText('')
      setMcqOptions(['', '', '', ''])
      setCorrectIndex(0)
      await load()
    } finally {
      setSavingQuestion(false)
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!confirm('متأكد إنك عايز تمسح السؤال ده؟')) return
    await fetch(`/api/teacher/quizzes/${quizId}/questions/${questionId}`, { method: 'DELETE' })
    await load()
  }

  async function handleGenerate() {
    setAiError('')
    if (lessonContent.trim().length < 30) {
      setAiError('ضيف محتوى أطول شوية عشان الـ AI يقدر يكوّن أسئلة كويسة')
      return
    }
    setAiLoading(true)
    setSuggestions([])
    try {
      const res = await fetch(`/api/teacher/quizzes/${quizId}/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonContent, count: aiCount }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error || 'حصل خطأ في التوليد')
        return
      }
      setSuggestions(data.questions)
      setSelectedSuggestions(data.questions.map(() => true))
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSaveSuggestions() {
    const chosen = suggestions.filter((_, i) => selectedSuggestions[i])
    if (chosen.length === 0) return
    setSavingSuggestions(true)
    try {
      const res = await fetch(`/api/teacher/quizzes/${quizId}/questions/bulk-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: chosen }),
      })
      if (res.ok) {
        setSuggestions([])
        setLessonContent('')
        setShowAiPanel(false)
        await load()
      }
    } finally {
      setSavingSuggestions(false)
    }
  }

  async function handleTogglePublish() {
    if (!quiz) return
    const res = await fetch(`/api/teacher/quizzes/${quiz.id}`, { method: 'PATCH' })
    const data = await res.json()
    if (res.ok) {
      setQuiz({ ...quiz, is_published: data.isPublished })
    } else {
      alert(data.error || 'حصل خطأ')
    }
  }

  async function handleDeleteQuiz() {
    if (!quiz || !confirm('متأكد إنك عايز تمسح الكويز ده بكل أسئلته؟')) return
    const res = await fetch(`/api/teacher/quizzes/${quiz.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/teacher/quizzes')
  }

  if (loading || !quiz) {
    return (
      <DashboardShell navItems={NAV_ITEMS} userName={teacherName || 'معلم'} roleLabel="حساب معلم">
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell navItems={NAV_ITEMS} userName={teacherName || 'معلم'} roleLabel="حساب معلم">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="min-w-0">
          <Link href="/teacher/quizzes" className="text-xs text-ink/40 hover:text-gold">
            ← كل الكويزات
          </Link>
          <h1 className="font-display text-xl font-bold truncate mt-1">{quiz.title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTogglePublish}
            className={`text-sm font-bold px-4 py-2 rounded-xl transition-opacity hover:opacity-90 ${
              quiz.is_published ? 'bg-ink/10 text-ink' : 'bg-gold text-board'
            }`}
          >
            {quiz.is_published ? 'إلغاء النشر' : 'نشر الكويز'}
          </button>
          <button
            onClick={handleDeleteQuiz}
            className="text-sm font-bold px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            حذف
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-paper border border-ink/10 rounded-2xl p-5">
            <h3 className="font-display font-bold mb-4">الأسئلة ({questions.length})</h3>
            {questions.length === 0 && <p className="text-ink/40 text-sm mb-4">لسه مفيش أسئلة</p>}
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={q.id} className="border border-ink/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-bold text-sm">
                      {i + 1}. {q.question_text}
                    </p>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="text-red-500 text-xs shrink-0 hover:underline"
                    >
                      حذف
                    </button>
                  </div>
                  <div className="space-y-1">
                    {q.quiz_options.map((o) => (
                      <p
                        key={o.id}
                        className={`text-xs px-3 py-1.5 rounded-lg ${
                          o.is_correct ? 'bg-gold/15 text-gold font-bold' : 'text-ink/60 bg-ink/5'
                        }`}
                      >
                        {o.option_text} {o.is_correct && '✓'}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-paper border border-ink/10 rounded-2xl p-5">
            <h3 className="font-display font-bold mb-4">إضافة سؤال يدوي</h3>
            <form onSubmit={handleAddQuestion} className="space-y-4">
              {formError && <p className="text-red-600 text-sm">{formError}</p>}

              <textarea
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="نص السؤال"
                className="w-full border border-ink/15 rounded-xl px-4 py-2.5 text-sm"
                rows={2}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQType('mcq')
                    setCorrectIndex(0)
                  }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                    qType === 'mcq' ? 'bg-board text-chalk' : 'bg-ink/5 text-ink/60'
                  }`}
                >
                  اختيار من متعدد
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQType('true_false')
                    setCorrectIndex(0)
                  }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                    qType === 'true_false' ? 'bg-board text-chalk' : 'bg-ink/5 text-ink/60'
                  }`}
                >
                  صح وغلط
                </button>
              </div>

              {qType === 'mcq' ? (
                <div className="space-y-2">
                  {mcqOptions.map((val, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct"
                        checked={correctIndex === i}
                        onChange={() => setCorrectIndex(i)}
                      />
                      <input
                        value={val}
                        onChange={(e) => {
                          const next = [...mcqOptions]
                          next[i] = e.target.value
                          setMcqOptions(next)
                        }}
                        placeholder={`اختيار ${i + 1}`}
                        className="flex-1 border border-ink/15 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="tf" checked={correctIndex === 0} onChange={() => setCorrectIndex(0)} />
                    صح
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="tf" checked={correctIndex === 1} onChange={() => setCorrectIndex(1)} />
                    غلط
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={savingQuestion}
                className="bg-board text-chalk font-bold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingQuestion ? 'جاري الإضافة...' : 'إضافة السؤال'}
              </button>
            </form>
          </div>
        </div>

        <div>
          <div className="bg-board text-chalk rounded-2xl p-5">
            <h3 className="font-display font-bold mb-2">✨ توليد أسئلة بالـ AI</h3>
            <p className="text-chalk/60 text-xs mb-4">
              الصق محتوى أو ملخص الدرس، وهنقترحلك أسئلة جاهزة تراجعها وتختار اللي عايزه
            </p>

            {!showAiPanel ? (
              <button
                onClick={() => setShowAiPanel(true)}
                className="bg-gold text-board font-bold text-sm px-4 py-2.5 rounded-xl w-full hover:opacity-90 transition-opacity"
              >
                ابدأ التوليد
              </button>
            ) : (
              <div className="space-y-3">
                {aiError && <p className="text-red-300 text-xs">{aiError}</p>}
                <textarea
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  placeholder="الصق نص الدرس أو ملخصه هنا..."
                  rows={6}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-ink"
                />
                <div className="flex items-center gap-3">
                  <label className="text-xs text-chalk/60 shrink-0">عدد الأسئلة</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-16 rounded-lg px-2 py-1.5 text-sm text-ink"
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={aiLoading}
                  className="bg-gold text-board font-bold text-sm px-4 py-2.5 rounded-xl w-full hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {aiLoading ? 'جاري التوليد...' : 'اقترح أسئلة'}
                </button>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="mt-5 space-y-3">
                <p className="text-xs text-chalk/60">راجع الأسئلة واختار اللي عايز تحفظه:</p>
                {suggestions.map((s, i) => (
                  <label key={i} className="flex items-start gap-2 bg-boardLight rounded-xl p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSuggestions[i]}
                      onChange={() => {
                        const next = [...selectedSuggestions]
                        next[i] = !next[i]
                        setSelectedSuggestions(next)
                      }}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{s.questionText}</p>
                      <div className="mt-1 space-y-0.5">
                        {s.options.map((o, oi) => (
                          <p key={oi} className={`text-xs ${o.isCorrect ? 'text-gold font-bold' : 'text-chalk/50'}`}>
                            {o.text} {o.isCorrect && '✓'}
                          </p>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
                <button
                  onClick={handleSaveSuggestions}
                  disabled={savingSuggestions}
                  className="bg-gold text-board font-bold text-sm px-4 py-2.5 rounded-xl w-full hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingSuggestions ? 'جاري الحفظ...' : `احفظ الأسئلة المختارة`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
