'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import DashboardShell, { NavItem } from '@/components/dashboard/DashboardShell'
import ProgressRing from '@/components/dashboard/ProgressRing'
import { StatCard, MiniCalendar } from '@/components/dashboard/widgets'
import { HomeIcon, BookIcon, UsersIcon, AwardIcon, ChatIcon } from '@/components/dashboard/icons'

const NAV_ITEMS: NavItem[] = [
  { href: '/student/dashboard', label: 'الرئيسية', icon: <HomeIcon /> },
  { href: '/student/courses', label: 'كورساتي', icon: <BookIcon /> },
  { href: '/student/quizzes', label: 'الكويزات', icon: <AwardIcon /> },
  { href: '/student/teachers', label: 'اختار معلم', icon: <UsersIcon /> },
  { href: '/student/grades', label: 'درجاتي', icon: <AwardIcon /> },
  { href: '/student/messages', label: 'الرسائل', icon: <ChatIcon /> },
]

interface EnrolledCourse {
  course_id: string
  courses: { title: string; teachers: { full_name: string } | null } | null
}

interface CourseProgress {
  totalVideos: number
  completedVideos: number
  lastVideoId: string | null
  lastVideoTitle: string | null
}

export default function StudentDashboard() {
  const router = useRouter()
  const [studentName, setStudentName] = useState('')
  const [courses, setCourses] = useState<EnrolledCourse[]>([])
  const [progressByCourseId, setProgressByCourseId] = useState<Record<string, CourseProgress>>({})
  const [watchHours, setWatchHours] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
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

      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id, courses(title, teachers(full_name))')
        .eq('student_id', studentId)
        .eq('is_active', true)

      const enrolledCourses = (enrollments as unknown as EnrolledCourse[]) || []
      setCourses(enrolledCourses)

      const courseIds = enrolledCourses.map((c) => c.course_id)

      if (courseIds.length > 0) {
        const { data: allVideos } = await supabase
          .from('videos')
          .select('id, course_id')
          .in('course_id', courseIds)

        const { data: views } = await supabase
          .from('video_views')
          .select('video_id, course_id, completed, max_position_seconds, updated_at, videos(title)')
          .eq('student_id', studentId)
          .in('course_id', courseIds)
          .order('updated_at', { ascending: false })

        const viewsList = (views as any[]) || []

        const progress: Record<string, CourseProgress> = {}
        for (const courseId of courseIds) {
          const total = (allVideos || []).filter((v) => v.course_id === courseId).length
          const courseViews = viewsList.filter((v) => v.course_id === courseId)
          const completed = courseViews.filter((v) => v.completed).length
          const last = courseViews[0]

          progress[courseId] = {
            totalVideos: total,
            completedVideos: completed,
            lastVideoId: last?.video_id || null,
            lastVideoTitle: last?.videos?.title || null,
          }
        }
        setProgressByCourseId(progress)

        const totalSeconds = viewsList.reduce((sum, v) => sum + Number(v.max_position_seconds || 0), 0)
        setWatchHours(Math.round((totalSeconds / 3600) * 10) / 10)
      }

      setLoading(false)
    }
    load()
  }, [router])

  const enrolledCount = courses.length
  const completedCount = Object.values(progressByCourseId).filter(
    (p) => p.totalVideos > 0 && p.completedVideos === p.totalVideos
  ).length

  const overallPercent = (() => {
    const withVideos = Object.values(progressByCourseId).filter((p) => p.totalVideos > 0)
    if (withVideos.length === 0) return 0
    const avg =
      withVideos.reduce((sum, p) => sum + p.completedVideos / p.totalVideos, 0) / withVideos.length
    return Math.round(avg * 100)
  })()

  const inProgress = courses
    .map((c) => ({ ...c, progress: progressByCourseId[c.course_id] }))
    .filter((c) => c.progress && c.progress.totalVideos > 0)

  return (
    <DashboardShell navItems={NAV_ITEMS} userName={studentName || 'طالب'} roleLabel="حساب طالب" searchable>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold">أهلاً بيك، {studentName.split(' ')[0] || ''} 👋</h1>
          <p className="text-ink/50 text-sm mt-1">كورساتك اللي مشترك فيها هتلاقيها هنا</p>
        </div>
      </div>

      {loading ? (
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      ) : (
        <>
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-board text-chalk rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex-1 text-center sm:text-right">
                <h2 className="font-display text-lg font-bold mb-2">
                  استمر في التعلم، أنت قدّامك {Math.max(enrolledCount - completedCount, 0)} كورس لسه
                </h2>
                <p className="text-chalk/60 text-sm mb-4">
                  خلّصت {completedCount} من {enrolledCount} كورس مشترك فيهم
                </p>
                {inProgress[0] && (
                  <Link
                    href={`/student/courses/${inProgress[0].course_id}/watch`}
                    className="inline-block bg-gold text-board font-bold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                  >
                    كمّل التعلم
                  </Link>
                )}
              </div>
              <div className="flex gap-4 shrink-0">
                <ProgressRing percent={overallPercent} label="نسبة الإنجاز" />
                <ProgressRing
                  percent={enrolledCount > 0 ? Math.min(100, (completedCount / enrolledCount) * 100) : 0}
                  value={completedCount}
                  label="كورسات مكتملة"
                  color="#7C9885"
                />
              </div>
            </div>

            <MiniCalendar />
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <StatCard label="كورسات مشترك فيها" value={enrolledCount} icon={<BookIcon />} />
            <StatCard label="كورسات مكتملة" value={completedCount} icon={<AwardIcon />} />
            <StatCard label="ساعات المشاهدة" value={`${watchHours} س`} icon={<UsersIcon />} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold">استكمل التعلم</h3>
                <Link href="/student/courses" className="text-gold text-sm hover:underline">
                  كل الكورسات
                </Link>
              </div>

              {inProgress.length === 0 && enrolledCount === 0 && (
                <div className="bg-paper border border-ink/10 rounded-2xl p-8 text-center">
                  <p className="text-ink/50 mb-3">لسه معملتش اشتراك في أي كورس</p>
                  <Link href="/student/teachers" className="text-gold underline text-sm">
                    اختار معلم وابدأ
                  </Link>
                </div>
              )}

              <div className="space-y-3">
                {(inProgress.length > 0 ? inProgress : courses).map((c) => {
                  const p = progressByCourseId[c.course_id]
                  const percent = p && p.totalVideos > 0 ? Math.round((p.completedVideos / p.totalVideos) * 100) : 0
                  return (
                    <Link
                      key={c.course_id}
                      href={`/student/courses/${c.course_id}/watch`}
                      className="flex items-center justify-between gap-4 bg-paper border border-ink/10 rounded-xl p-4 hover:border-gold/60 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate">{c.courses?.title}</p>
                        <p className="text-ink/40 text-xs mb-2">أ. {c.courses?.teachers?.full_name}</p>
                        <div className="w-full bg-ink/10 rounded-full h-1.5 overflow-hidden max-w-xs">
                          <div className="bg-gold h-full" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                      <span className="text-gold text-xs font-bold shrink-0">
                        {p && p.totalVideos > 0 ? `${percent}%` : 'ابدأ'}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <Link
                href="/student/teachers"
                className="block bg-paper border border-ink/10 rounded-2xl p-5 hover:border-gold/60 transition-colors"
              >
                <h4 className="font-display font-bold mb-1">اختار معلم جديد</h4>
                <p className="text-ink/50 text-xs">شوف المعلمين المتاحين واشترك في كورس جديد</p>
              </Link>
              <Link
                href="/student/grades"
                className="block bg-paper border border-ink/10 rounded-2xl p-5 hover:border-gold/60 transition-colors"
              >
                <h4 className="font-display font-bold mb-1">درجاتي وحضوري</h4>
                <p className="text-ink/50 text-xs">تابع تقييماتك وحضورك أول بأول</p>
              </Link>
              <Link
                href="/student/messages"
                className="block bg-paper border border-ink/10 rounded-2xl p-5 hover:border-gold/60 transition-colors"
              >
                <h4 className="font-display font-bold mb-1">الرسائل</h4>
                <p className="text-ink/50 text-xs">تواصل مباشر مع معلمينك</p>
              </Link>
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  )
}
