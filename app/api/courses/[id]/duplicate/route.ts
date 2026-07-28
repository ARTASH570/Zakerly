import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireTeacher } from '@/lib/auth'
import { verifyRequestOrigin } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rateLimit'
import { logActivity } from '@/lib/activityLog'

// POST /api/courses/[id]/duplicate
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireTeacher()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { teacherId } = auth

    if (!(await checkRateLimit(`course-duplicate:${teacherId}`, 10, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    // 1. تأكد إن الكورس الأصلي فعلاً بتاع المعلم ده
    const { data: originalCourse } = await supabaseAdmin
      .from('courses')
      .select('*')
      .eq('id', params.id)
      .eq('teacher_id', teacherId)
      .single()

    if (!originalCourse) {
      return NextResponse.json({ error: 'الكورس مش موجود' }, { status: 404 })
    }

    // 2. اعمل نسخة من الكورس - مش منشورة تلقائيًا، عشان المعلم يراجعها الأول قبل ما تظهر للطلاب
    const { data: newCourse, error: courseError } = await supabaseAdmin
      .from('courses')
      .insert({
        teacher_id: teacherId,
        title: `${originalCourse.title} (نسخة)`,
        description: originalCourse.description,
        price: originalCourse.price,
        is_published: false,
      })
      .select()
      .single()

    if (courseError || !newCourse) {
      return NextResponse.json({ error: 'حصل خطأ في تكرار الكورس' }, { status: 500 })
    }

    // 3. انسخ كل الأقسام الأول، وبعدين الفيديوهات جوه كل قسم - عشان الهيكل يفضل زي ما هو بالظبط
    const { data: originalSections } = await supabaseAdmin
      .from('sections')
      .select('id, title, order_index')
      .eq('course_id', params.id)
      .order('order_index', { ascending: true })

    const sectionIdMap = new Map<string, string>() // القديم -> الجديد

    for (const section of originalSections || []) {
      const { data: newSection } = await supabaseAdmin
        .from('sections')
        .insert({ course_id: newCourse.id, title: section.title, order_index: section.order_index })
        .select()
        .single()

      if (newSection) {
        sectionIdMap.set(section.id, newSection.id)
      }
    }

    // انسخ كل الفيديوهات - بنشاور على نفس الفيديو المرفوع أصلًا على Bunny،
    // مفيش رفع أو ترميز جديد، فده سريع ومجاني تمامًا
    const { data: originalVideos } = await supabaseAdmin
      .from('videos')
      .select('title, bunny_video_id, duration_seconds, order_index, section_id')
      .eq('course_id', params.id)
      .order('order_index', { ascending: true })

    if (originalVideos && originalVideos.length > 0) {
      await supabaseAdmin.from('videos').insert(
        originalVideos.map((v) => ({
          course_id: newCourse.id,
          section_id: v.section_id ? sectionIdMap.get(v.section_id) : null,
          title: v.title,
          bunny_video_id: v.bunny_video_id,
          duration_seconds: v.duration_seconds,
          order_index: v.order_index,
        }))
      )
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'course.create',
      entityType: 'course',
      entityId: newCourse.id,
      metadata: { duplicatedFrom: params.id },
      request,
    })

    return NextResponse.json({ course: newCourse })
  } catch (err) {
    console.error('Course duplicate error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
