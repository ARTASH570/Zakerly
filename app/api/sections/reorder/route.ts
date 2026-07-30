import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { reorderSectionsSchema, validate } from '@/lib/shared/validation'

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

    // تحقق أمان إضافي: تأكد إن كل الأقسام المبعوتة فعلاً من نفس الكورس
    // (يمنع محاولة خبيثة لإعادة ترتيب قسم بتاع كورس تاني عن طريق تمرير الـ ID بتاعه)
    const { count } = await supabaseAdmin
      .from('sections')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', courseId)
      .in('id', orderedSectionIds)

    if (count !== orderedSectionIds.length) {
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 })
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
