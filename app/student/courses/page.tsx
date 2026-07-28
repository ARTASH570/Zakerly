'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

interface EnrolledCourse {
  course_id: string
  courses: {
    title: string
    teachers: { full_name: string } | null
  } | null
}

interface VideoView {
  video_id: string
  course_id: string
  completed: boolean
  max_position_seconds: number
  duration_seconds: number | null
  updated_at: string
  videos: { title: string } | null
}

interface CourseProgress {
  totalVideos: number
  completedVideos: number
  lastVideoId: string | null
  lastVideoTitle: string | null
}

export default function MyCoursesPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<EnrolledCourse[]>([])
  const [progressByCourseId, setProgressByCourseId] = useState<Record<string, CourseProgress>>({})
  const [continueWatching, setContinueWatching] = useState<VideoView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login?role=student')
        return
      }
      const studentId = userData.user.id

      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id, courses(title, teachers(full_name))')
        .eq('student_id', studentId)
        .eq('is_active', true)

      const enrolledCourses = (enrollments as unknown as EnrolledCourse[]) || []
      setCourses(enrolledCourses)

      const courseIds = enrolledCourses.map((c) => c.course_id)

      if (courseIds.length > 0) {
        // عدد الفيديوهات الكلي لكل كورس (عشان نحسب نسبة التقدم)
        const { data: allVideos } = await supabase
          .from('videos')
          .select('id, course_id')
          .in('course_id', courseIds)

        // تقدم الطالب الفعلي في كل فيديو شافه
        const { data: views } = await supabase
          .from('video_views')
          .select('video_id, course_id, completed, max_position_seconds, duration_seconds, updated_at, videos(title)')
          .eq('student_id', studentId)
          .in('course_id', courseIds)
          .order('updated_at', { ascending: false })

        const viewsList = (views as unknown as VideoView[]) || []

        // احسب تقدم كل كورس + آخر فيديو اتفرج عليه
        const progress: Record<string, CourseProgress> = {}
        for (const courseId of courseIds) {
          const total = (allVideos || []).filter((v) => v.course_id === courseId).length
          const courseViews = viewsList.filter((v) => v.course_id === courseId)
          const completed = courseViews.filter((v) => v.completed).length
          const last = courseViews[0] // أول واحد لأن الاستعلام مرتب بالأحدث

          progress[courseId] = {
            totalVideos: total,
            completedVideos: completed,
            lastVideoId: last?.video_id || null,
            lastVideoTitle: last?.videos?.title || null,
          }
        }
        setProgressByCourseId(progress)

        // "استكمل المشاهدة" - أحدث 3 فيديوهات لسه مخلصتش عبر كل الكورسات
        setContinueWatching(viewsList.filter((v) => !v.completed).slice(0, 3))
      }

      setLoading(false)
    }
    load()
  }, [router])

  function courseTitle(courseId: string) {
    return courses.find((c) => c.course_id === courseId)?.courses?.title || ''
  }

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl font-bold">كورساتي</h1>
          <Link href="/student/dashboard" className="text-chalk/60 text-sm hover:text-gold">
            رجوع للداشبورد
          </Link>
        </div>

        {loading && <p className="text-chalk/50">جاري التحميل...</p>}

        {/* استكمال المشاهدة */}
        {!loading && continueWatching.length > 0 && (
          <div className="mb-10">
            <h3 className="font-display font-bold mb-3">استكمل المشاهدة</h3>
            <div className="space-y-2">
              {continueWatching.map((v) => (
                <Link
                  key={v.video_id}
                  href={`/student/courses/${v.course_id}/watch?videoId=${v.video_id}`}
                  className="flex items-center justify-between bg-boardLight border border-line rounded-lg px-4 py-3 hover:border-gold/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold">{v.videos?.title}</p>
                    <p className="text-chalk/40 text-xs">{courseTitle(v.course_id)}</p>
                  </div>
                  <span className="text-gold text-xs">كمّل ←</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading && courses.length === 0 && (
          <div className="text-center py-10">
            <p className="text-chalk/60 mb-4">لسه معملتش اشتراك في أي كورس</p>
            <Link href="/student/teachers" className="text-gold underline">
              اختار معلم وابدأ
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {courses.map((enrollment) => {
            const progress = progressByCourseId[enrollment.course_id]
            const percent =
              progress && progress.totalVideos > 0
                ? Math.round((progress.completedVideos / progress.totalVideos) * 100)
                : 0

            return (
              <div
                key={enrollment.course_id}
                className="bg-boardLight border border-line rounded-xl p-5"
              >
                <Link
                  href={`/student/courses/${enrollment.course_id}/watch`}
                  className="flex items-center justify-between mb-2"
                >
                  <div>
                    <p className="font-bold">{enrollment.courses?.title}</p>
                    <p className="text-chalk/50 text-sm">
                      أ. {enrollment.courses?.teachers?.full_name}
                    </p>
                  </div>
                  <span className="text-gold text-sm">شاهد ←</span>
                </Link>

                {progress && progress.totalVideos > 0 && (
                  <>
                    <div className="w-full bg-board rounded-full h-1.5 mt-3 overflow-hidden">
                      <div className="bg-gold h-full" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-chalk/40 text-xs">
                        {progress.completedVideos} من {progress.totalVideos} مكتمل ({percent}%)
                      </p>
                      {progress.lastVideoId && (
                        <Link
                          href={`/student/courses/${enrollment.course_id}/watch?videoId=${progress.lastVideoId}`}
                          className="text-gold text-xs"
                        >
                          استكمل من {progress.lastVideoTitle}
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
