import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireTeacher } from '@/lib/auth'
import { verifyRequestOrigin } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rateLimit'
import { reorderSectionsSchema, validate } from '@/lib/validation'

// POST /api/sections/reorder
// Body: { courseId, orderedSectionIds: string[] }
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

    if (!(await checkRateLimit(`section-reorder:${teacherId}`, 60, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(reorderSectionsSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { courseId, orderedSectionIds } = parsed.data

    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('teacher_id', teacherId)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'مش مسموحلك' }, { status: 403 })
    }

    // ⚠️ استدعاء دالة atomic في قاعدة البيانات بدل N تحديثات منفصلة -
    // التحديث كله بينفذ في عملية واحدة، إما ينجح كامل أو يفشل كامل
    const { error } = await supabaseAdmin.rpc('reorder_sections', {
      p_section_ids: orderedSectionIds,
    })

    if (error) {
      return NextResponse.json({ error: 'حصل خطأ في إعادة الترتيب' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Section reorder error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
