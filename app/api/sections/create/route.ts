import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireTeacher } from '@/lib/auth'
import { verifyRequestOrigin } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rateLimit'
import { createSectionSchema, validate } from '@/lib/validation'

// POST /api/sections/create
// Body: { courseId: string, title: string }
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

    if (!(await checkRateLimit(`section-create:${teacherId}`, 30, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(createSectionSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { courseId, title } = parsed.data

    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('teacher_id', teacherId)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'مش مسموحلك' }, { status: 403 })
    }

    const { data: maxOrder } = await supabaseAdmin
      .from('sections')
      .select('order_index')
      .eq('course_id', courseId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: section, error } = await supabaseAdmin
      .from('sections')
      .insert({
        course_id: courseId,
        title,
        order_index: (maxOrder?.order_index ?? -1) + 1,
      })
      .select()
      .single()

    if (error || !section) {
      return NextResponse.json({ error: 'حصل خطأ في إنشاء القسم' }, { status: 500 })
    }

    return NextResponse.json({ section })
  } catch (err) {
    console.error('Section create error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
