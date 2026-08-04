'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useCachedFetch } from '@/lib/shared/useCachedFetch'

interface Course {
  id: string
  title: string
  description: string | null
  price: number
  teacher_id: string
}

interface PublicTeacherProfile {
  id: string
  full_name: string
  subject: string | null
  bio: string | null
}

interface CourseWithTeacher extends Course {
  teacher: PublicTeacherProfile | undefined
}

export default function BrowseTeachersPage() {
  const [searchTerm, setSearchTerm] = useState('')

  // بيانات عامة (كورسات منشورة + بروفايلات معلمين آمنة) بتتغير مش كتير -
  // بنكاشها دقيقة في ذاكرة المتصفح عشان لو الطالب رجع للصفحة دي تاني وهو
  // بيتنقل بين الكورسات، مايحصلش استعلام جديد للداتابيز كل مرة
  const fetchCourses = useCallback(async (): Promise<CourseWithTeacher[]> => {
    // 1. هات الكورسات المنشورة (الأعمدة العادية بس، من غير بيانات المعلم الحساسة)
    const { data: courseRows, error } = await supabase
      .from('courses')
      .select('id, title, description, price, teacher_id')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (error || !courseRows) return []

    // 2. هات بيانات المعلمين الآمنة بس (View مخصص، مش الجدول الأصلي) لكل المعلمين المعنيين
    const teacherIds = Array.from(new Set(courseRows.map((c) => c.teacher_id)))
    const { data: teacherRows } = await supabase
      .from('public_teacher_profiles')
      .select('id, full_name, subject, bio')
      .in('id', teacherIds)

    const teacherMap = new Map((teacherRows || []).map((t) => [t.id, t]))

    return courseRows.map((c) => ({ ...c, teacher: teacherMap.get(c.teacher_id) }))
  }, [])

  const { data: courses, loading } = useCachedFetch('public-courses-list', fetchCourses, 60_000)

  const filtered = (courses || []).filter((c) => {
    const term = searchTerm.trim()
    if (!term) return true
    return (
      c.title.includes(term) ||
      c.teacher?.full_name?.includes(term) ||
      c.teacher?.subject?.includes(term)
    )
  })

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-2xl font-bold">اختار معلمك</h1>
          <Link href="/student/dashboard" className="text-chalk/60 text-sm hover:text-gold">
            رجوع للداشبورد
          </Link>
        </div>
        <p className="text-chalk/60 mb-8">تصفح الكورسات المتاحة واختار المعلم اللي يناسبك</p>

        <input
          type="text"
          placeholder="دور بالاسم أو المادة..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-boardLight border border-line rounded-lg px-4 py-3 mb-8 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
        />

        {loading && <p className="text-chalk/50">جاري التحميل...</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-chalk/50">مفيش كورسات متاحة دلوقتي، حاول تاني بعدين.</p>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {filtered.map((course) => (
            <Link
              key={course.id}
              href={`/student/courses/${course.id}`}
              className="bg-boardLight border border-line rounded-xl p-6 hover:border-gold/50 transition-colors block"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display font-bold text-lg text-chalk">
                    {course.teacher?.full_name}
                  </h3>
                  {course.teacher?.subject && (
                    <span className="inline-block bg-gold/10 text-gold text-xs px-2 py-1 rounded-full mt-1">
                      {course.teacher.subject}
                    </span>
                  )}
                </div>
                <span className="text-gold font-bold whitespace-nowrap">
                  {course.price} ج.م
                </span>
              </div>
              <p className="font-bold text-chalk/90 mb-1">{course.title}</p>
              {course.description && (
                <p className="text-chalk/60 text-sm line-clamp-2">{course.description}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
