'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import PaymentButton from '@/features/payments/components/PaymentButton'

interface CourseDetail {
  id: string
  title: string
  description: string | null
  price: number
  teacher_id: string
}

interface PublicTeacherProfile {
  full_name: string
  subject: string | null
  bio: string | null
}

export default function CourseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [teacher, setTeacher] = useState<PublicTeacherProfile | null>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [isEgyptOrMena, setIsEgyptOrMena] = useState(true)
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // 1. تأكد إن الطالب مسجل دخول
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push(`/login/student?redirect=/student/courses/${courseId}`)
        return
      }
      setStudentId(userData.user.id)

      // 2. هات بيانات الكورس (من غير بيانات المعلم الحساسة)
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, title, description, price, teacher_id')
        .eq('id', courseId)
        .single()

      setCourse(courseData)

      // 3. هات بيانات المعلم الآمنة بس من الـ View المخصص
      if (courseData) {
        const { data: teacherData } = await supabase
          .from('public_teacher_profiles')
          .select('full_name, subject, bio')
          .eq('id', courseData.teacher_id)
          .single()
        setTeacher(teacherData)
      }

      // 4. تأكد لو الطالب مشترك فعلاً
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', userData.user.id)
        .eq('course_id', courseId)
        .eq('is_active', true)
        .maybeSingle()

      setAlreadyEnrolled(!!enrollment)
      setLoading(false)
    }
    load()
  }, [courseId, router])

  if (loading) {
    return (
      <main className="min-h-screen bg-board text-chalk px-6 py-10 flex items-center justify-center">
        <p className="text-chalk/50">جاري التحميل...</p>
      </main>
    )
  }

  if (!course) {
    return (
      <main className="min-h-screen bg-board text-chalk px-6 py-10 flex items-center justify-center">
        <p className="text-chalk/50">الكورس ده مش موجود</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/student/teachers" className="text-chalk/60 text-sm hover:text-gold">
          ← رجوع لكل المعلمين
        </Link>

        <div className="bg-boardLight border border-line rounded-2xl p-8 mt-6">
          <span className="inline-block bg-gold/10 text-gold text-xs px-2 py-1 rounded-full mb-3">
            {teacher?.subject || 'كورس'}
          </span>
          <h1 className="font-display text-2xl font-bold mb-1">{course.title}</h1>
          <p className="text-chalk/60 mb-6">مع {teacher?.full_name}</p>

          {course.description && (
            <p className="text-chalk/80 leading-relaxed mb-6">{course.description}</p>
          )}

          {teacher?.bio && (
            <div className="border-t border-line pt-4 mb-6">
              <p className="text-chalk/50 text-sm mb-1">عن المعلم</p>
              <p className="text-chalk/70 text-sm leading-relaxed">{teacher.bio}</p>
            </div>
          )}

          {alreadyEnrolled ? (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-4 text-center">
              <p className="text-gold font-bold">أنت مشترك في الكورس ده بالفعل ✓</p>
              <Link
                href={`/student/courses/${course.id}/watch`}
                className="text-chalk/70 text-sm underline mt-2 inline-block"
              >
                شاهد الفيديوهات
              </Link>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-chalk/60 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!isEgyptOrMena}
                  onChange={(e) => setIsEgyptOrMena(!e.target.checked)}
                  className="accent-gold"
                />
                بدفع من برة مصر/المنطقة (بطاقة دولية)
              </label>

              {studentId && (
                <PaymentButton courseId={course.id} price={course.price} isEgyptOrMena={isEgyptOrMena} />
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
