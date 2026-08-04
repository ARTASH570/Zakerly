'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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

interface Course {
  id: string
  title: string
}

interface Quiz {
  id: string
  title: string
  is_published: boolean
  course_id: string
  ai_generated: boolean
  courses: { title: string } | null
  quiz_questions: { count: number }[]
}

export default function TeacherQuizzesPage() {
  const router = useRouter()
  const [teacherName, setTeacherName] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [maxAttempts, setMaxAttempts] = useState(1)

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

    const { data: coursesData } = await supabase
      .from('courses')
      .select('id, title')
      .eq('teacher_id', userData.user.id)
      .order('created_at', { ascending: false })
    setCourses(coursesData || [])
    if (coursesData?.[0]) setCourseId(coursesData[0].id)

    const { data: quizzesData } = await supabase
      .from('quizzes')
      .select('id, title, is_published, course_id, ai_generated, courses(title), quiz_questions(count)')
      .order('created_at', { ascending: false })
    setQuizzes((quizzesData as unknown as Quiz[]) || [])

    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !courseId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/teacher/quizzes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, courseId, maxAttempts }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'حصل خطأ')
        return
      }
      router.push(`/teacher/quizzes/${data.quiz.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell navItems={NAV_ITEMS} userName={teacherName || 'معلم'} roleLabel="حساب معلم">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold">الكويزات</h1>
          <p className="text-ink/50 text-sm mt-1">اعمل كويزات لكورساتك، يدويًا أو بالـ AI</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-gold text-board font-bold text-sm px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shrink-0"
        >
          + كويز جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-paper border border-ink/10 rounded-2xl p-5 mb-6 space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}

          {courses.length === 0 ? (
            <p className="text-ink/50 text-sm">لازم يكون عندك كورس واحد على الأقل قبل ما تعمل كويز.</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-bold mb-1.5">عنوان الكويز</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: مراجعة الوحدة الأولى"
                  className="w-full border border-ink/15 rounded-xl px-4 py-2.5 text-sm"
                  required
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1.5">الكورس</label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full border border-ink/15 rounded-xl px-4 py-2.5 text-sm"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5">عدد المحاولات المسموحة</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value))}
                    className="w-full border border-ink/15 rounded-xl px-4 py-2.5 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="bg-board text-chalk font-bold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'جاري الإنشاء...' : 'إنشاء ومتابعة إضافة الأسئلة'}
              </button>
            </>
          )}
        </form>
      )}

      {loading ? (
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      ) : quizzes.length === 0 ? (
        <div className="bg-paper border border-ink/10 rounded-2xl p-8 text-center">
          <p className="text-ink/50">لسه معملتش أي كويز</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map((q) => (
            <Link
              key={q.id}
              href={`/teacher/quizzes/${q.id}`}
              className="flex items-center justify-between gap-4 bg-paper border border-ink/10 rounded-xl p-4 hover:border-gold/60 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{q.title}</p>
                <p className="text-ink/40 text-xs mt-0.5">
                  {q.courses?.title} · {q.quiz_questions?.[0]?.count ?? 0} سؤال
                  {q.ai_generated ? ' · بمساعدة AI' : ''}
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                  q.is_published ? 'bg-gold/15 text-gold' : 'bg-ink/10 text-ink/50'
                }`}
              >
                {q.is_published ? 'منشور' : 'مسودة'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  )
}
