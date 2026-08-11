'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

interface Course {
  id: string
  title: string
  price: number
  is_published: boolean
  publish_at: string | null
  unpublish_at: string | null
}

export default function TeacherCoursesPage() {
  const router = useRouter()
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [pendingDeletionCourseIds, setPendingDeletionCourseIds] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [publishAt, setPublishAt] = useState('')
  const [unpublishAt, setUnpublishAt] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadCourses(currentTeacherId: string) {
    const { data } = await supabase
      .from('courses')
      .select('id, title, price, is_published, publish_at, unpublish_at')
      .eq('teacher_id', currentTeacherId)
      .order('created_at', { ascending: false })

    setCourses(data || [])

    const { data: pending } = await supabase
      .from('deletion_requests')
      .select('course_id')
      .eq('teacher_id', currentTeacherId)
      .eq('status', 'pending')

    setPendingDeletionCourseIds(new Set((pending || []).map((r) => r.course_id)))
  }

  useEffect(() => {
    async function load() {
      // ⚠️ نحاول getSession الأول (بيقرأ من الكوكيز المحلية على طول، أسرع وأضمن
      // من getUser() لو الجلسة لسه بتتزامن بعد تسجيل دخول حديث)
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login/teacher')
        return
      }

      setTeacherId(sessionData.session.user.id)
      await loadCourses(sessionData.session.user.id)
      setLoading(false)
    }
    load()
  }, [])

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault()
    if (!teacherId || !title.trim() || !price) return

    setSaving(true)
    try {
      const res = await fetch('/api/courses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          price: Number(price),
          publishAt: publishAt ? new Date(publishAt).toISOString() : null,
          unpublishAt: unpublishAt ? new Date(unpublishAt).toISOString() : null,
        }),
      })
      const data = await res.json()

      if (res.ok && data.course) {
        setCourses([data.course, ...courses])
        setTitle('')
        setDescription('')
        setPrice('')
        setPublishAt('')
        setUnpublishAt('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicate(courseId: string) {
    if (!teacherId) return
    setDuplicatingId(courseId)
    try {
      const res = await fetch(`/api/courses/${courseId}/duplicate`, { method: 'POST' })
      if (res.ok) {
        await loadCourses(teacherId)
      }
    } finally {
      setDuplicatingId(null)
    }
  }

  async function handleDelete(courseId: string, courseTitle: string) {
    if (!teacherId) return
    if (!confirm(`متأكد إنك عايز تمسح كورس "${courseTitle}"؟ الإجراء ده مش هيترجع.`)) return

    setDeletingId(courseId)
    try {
      const res = await fetch(`/api/courses/${courseId}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'حصل خطأ')
        return
      }

      if (data.action === 'deleted') {
        setCourses(courses.filter((c) => c.id !== courseId))
      } else if (data.action === 'requested') {
        alert('الكورس ده فيه طلاب مشتركين، فتم إرسال طلب حذف للأدمن للمراجعة.')
        await loadCourses(teacherId)
      }
    } finally {
      setDeletingId(null)
    }
  }

  function scheduleLabel(course: Course) {
    const now = new Date()
    if (course.publish_at && new Date(course.publish_at) > now) {
      return `هينشر في ${new Date(course.publish_at).toLocaleDateString('ar-EG')}`
    }
    if (course.unpublish_at && new Date(course.unpublish_at) > now) {
      return `هيتخفي في ${new Date(course.unpublish_at).toLocaleDateString('ar-EG')}`
    }
    if (course.unpublish_at && new Date(course.unpublish_at) <= now) {
      return 'مخفي حاليًا (انتهت مدة النشر)'
    }
    return null
  }

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl font-bold">كورساتي</h1>
          <Link href="/teacher/dashboard" className="text-chalk/60 text-sm hover:text-gold">
            رجوع للداشبورد
          </Link>
        </div>

        <form
          onSubmit={handleAddCourse}
          className="bg-boardLight border border-line rounded-xl p-6 mb-8 space-y-3"
        >
          <h3 className="font-display font-bold mb-2">أضف كورس جديد</h3>
          <input
            type="text"
            placeholder="اسم الكورس"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full bg-board border border-line rounded-lg px-4 py-3 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
          />
          <textarea
            placeholder="وصف قصير عن الكورس"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-board border border-line rounded-lg px-4 py-3 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
          />
          <input
            type="number"
            placeholder="السعر بالجنيه"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            min={0}
            className="w-full bg-board border border-line rounded-lg px-4 py-3 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
          />

          <button
            type="button"
            onClick={() => setShowSchedule(!showSchedule)}
            className="text-gold text-sm"
          >
            {showSchedule ? '− إخفاء خيارات الجدولة' : '+ جدولة النشر (اختياري)'}
          </button>

          {showSchedule && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-chalk/50 text-xs mb-1 block">ينشر في (اختياري)</label>
                <input
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  className="w-full bg-board border border-line rounded-lg px-3 py-2 text-chalk text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="text-chalk/50 text-xs mb-1 block">يتخفي في (اختياري)</label>
                <input
                  type="datetime-local"
                  value={unpublishAt}
                  onChange={(e) => setUnpublishAt(e.target.value)}
                  className="w-full bg-board border border-line rounded-lg px-3 py-2 text-chalk text-sm focus:outline-none focus:border-gold"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-gold text-board font-bold rounded-lg px-6 py-3 hover:bg-gold/90 transition-colors disabled:opacity-50 w-full"
          >
            {saving ? 'جاري الإضافة...' : 'أضف الكورس'}
          </button>
        </form>

        {loading && <p className="text-chalk/50">جاري التحميل...</p>}

        <div className="space-y-3">
          {courses.map((course) => {
            const schedule = scheduleLabel(course)
            const isPendingDeletion = pendingDeletionCourseIds.has(course.id)
            return (
              <div
                key={course.id}
                className="flex items-center justify-between bg-boardLight border border-line rounded-xl p-5 hover:border-gold/50 transition-colors"
              >
                <Link href={`/teacher/courses/${course.id}`} className="flex-1">
                  <p className="font-bold">{course.title}</p>
                  <p className="text-chalk/50 text-sm">{course.price} ج.م</p>
                  {schedule && <p className="text-gold/70 text-xs mt-1">{schedule}</p>}
                  {isPendingDeletion && (
                    <p className="text-red-400 text-xs mt-1">طلب الحذف قيد المراجعة من الأدمن</p>
                  )}
                </Link>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleDuplicate(course.id)}
                    disabled={duplicatingId === course.id}
                    className="text-chalk/50 text-sm hover:text-gold disabled:opacity-50"
                  >
                    {duplicatingId === course.id ? 'جاري النسخ...' : 'كرر'}
                  </button>
                  {!isPendingDeletion && (
                    <button
                      onClick={() => handleDelete(course.id, course.title)}
                      disabled={deletingId === course.id}
                      className="text-red-400 text-sm hover:text-red-300 disabled:opacity-50"
                    >
                      {deletingId === course.id ? '...' : 'حذف'}
                    </button>
                  )}
                  <Link href={`/teacher/courses/${course.id}`} className="text-gold text-sm">
                    إدارة ←
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
