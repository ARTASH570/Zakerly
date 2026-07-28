import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireTeacher } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/teacher/dashboard/stats
export async function GET(request: Request) {
  try {
    const auth = await requireTeacher()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { teacherId } = auth

    // 1. كل كورسات المعلم ده
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id, title, price')
      .eq('teacher_id', teacherId)

    const courseIds = (courses || []).map((c) => c.id)

    if (courseIds.length === 0) {
      return NextResponse.json({
        totalStudents: 0,
        activeStudents: 0,
        totalRevenue: 0,
        monthlyRevenue: [],
        courseSales: [],
        recentActivity: [],
        mostWatchedVideos: [],
        totalWatchTimeHours: 0,
      })
    }

    // 2. الطلاب (كلي ونشط) عبر كل الكورسات
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('student_id, course_id, is_active, enrolled_at')
      .in('course_id', courseIds)

    const totalStudents = new Set((enrollments || []).map((e) => e.student_id)).size
    const activeStudents = new Set(
      (enrollments || []).filter((e) => e.is_active).map((e) => e.student_id)
    ).size

    // 3. المدفوعات الناجحة بس عشان نحسب الإيرادات
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('amount, course_id, created_at')
      .in('course_id', courseIds)
      .eq('status', 'success')

    const totalRevenue = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)

    // 4. الإيراد الشهري لآخر 6 شهور
    const monthlyMap = new Map<string, number>()
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' })
      monthlyMap.set(key, 0)
    }
    for (const p of payments || []) {
      const d = new Date(p.created_at)
      const key = d.toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' })
      if (monthlyMap.has(key)) {
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + Number(p.amount))
      }
    }
    const monthlyRevenue = Array.from(monthlyMap.entries()).map(([month, revenue]) => ({
      month,
      revenue,
    }))

    // 5. مبيعات كل كورس (عدد الاشتراكات)
    const courseSales = (courses || []).map((course) => ({
      title: course.title,
      sales: (enrollments || []).filter((e) => e.course_id === course.id).length,
    }))

    // 6. آخر الأنشطة المرتبطة بالمعلم ده (أفعاله هو + الأحداث على كورساته)
    const { data: ownActivity } = await supabaseAdmin
      .from('activity_logs')
      .select('id, action, entity_type, entity_id, metadata, created_at')
      .eq('user_id', teacherId)
      .order('created_at', { ascending: false })
      .limit(10)

    const { data: courseActivity } = await supabaseAdmin
      .from('activity_logs')
      .select('id, action, entity_type, entity_id, metadata, created_at')
      .in('entity_id', courseIds)
      .order('created_at', { ascending: false })
      .limit(10)

    const recentActivity = [...(ownActivity || []), ...(courseActivity || [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 15)

    // 7. إحصائيات المشاهدة (الفيديوهات الأكتر مشاهدة، نسبة الإكمال، إجمالي وقت المشاهدة)
    const { data: videos } = await supabaseAdmin
      .from('videos')
      .select('id, title, course_id')
      .in('course_id', courseIds)

    const videoIds = (videos || []).map((v) => v.id)

    let mostWatchedVideos: { title: string; views: number; completionRate: number }[] = []
    let totalWatchTimeSeconds = 0

    if (videoIds.length > 0) {
      const { data: views } = await supabaseAdmin
        .from('video_views')
        .select('video_id, max_position_seconds, completed')
        .in('video_id', videoIds)

      totalWatchTimeSeconds = (views || []).reduce(
        (sum, v) => sum + Number(v.max_position_seconds || 0),
        0
      )

      mostWatchedVideos = (videos || [])
        .map((video) => {
          const videoViews = (views || []).filter((v) => v.video_id === video.id)
          const completedCount = videoViews.filter((v) => v.completed).length
          return {
            title: video.title,
            views: videoViews.length,
            completionRate:
              videoViews.length > 0 ? Math.round((completedCount / videoViews.length) * 100) : 0,
          }
        })
        .sort((a, b) => b.views - a.views)
        .slice(0, 5)
    }

    return NextResponse.json({
      totalStudents,
      activeStudents,
      totalRevenue,
      monthlyRevenue,
      courseSales,
      recentActivity,
      mostWatchedVideos,
      totalWatchTimeHours: Math.round((totalWatchTimeSeconds / 3600) * 10) / 10,
    })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
