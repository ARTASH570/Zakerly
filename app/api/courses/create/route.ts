import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { createCourseSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/courses/create
// Body: { title, description?, price }
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireTeacher()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { teacherId } = auth

    if (!(await checkRateLimit(`course-create:${teacherId}`, 20, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(createCourseSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { title, description, price, publishAt, unpublishAt } = parsed.data

    const { data: course, error } = await supabaseAdmin
      .from('courses')
      .insert({
        teacher_id: teacherId,
        title,
        description: description || null,
        price,
        is_published: true,
        publish_at: publishAt || null,
        unpublish_at: unpublishAt || null,
      })
      .select()
      .single()

    if (error || !course) {
      return NextResponse.json({ error: 'حصل خطأ في إنشاء الكورس' }, { status: 500 })
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'course.create',
      entityType: 'course',
      entityId: course.id,
      metadata: { title, price },
      request,
    })

    return NextResponse.json({ course })
  } catch (err) {
    console.error('Course create error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
