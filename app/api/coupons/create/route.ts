import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { createCouponSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/coupons/create
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

    if (!(await checkRateLimit(`coupon-create:${teacherId}`, 20, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(createCouponSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { code, discountType, discountValue, courseId, minPrice, usageLimit, oneTimePerStudent, expiresAt } =
      parsed.data

    // لو الكوبون مرتبط بكورس معين، تأكد إنه فعلاً كورس المعلم ده
    if (courseId) {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('id')
        .eq('id', courseId)
        .eq('teacher_id', teacherId)
        .single()

      if (!course) {
        return NextResponse.json({ error: 'الكورس ده مش بتاعك' }, { status: 403 })
      }
    }

    const { data: coupon, error } = await supabaseAdmin
      .from('coupons')
      .insert({
        teacher_id: teacherId,
        code: code.toUpperCase(),
        discount_type: discountType,
        discount_value: discountValue,
        course_id: courseId || null,
        min_price: minPrice ?? null,
        usage_limit: usageLimit ?? null,
        one_time_per_student: oneTimePerStudent ?? true,
        expires_at: expiresAt || null,
      })
      .select()
      .single()

    if (error) {
      // unique(teacher_id, code) - يعني المعلم عنده كوبون بنفس الكود قبل كده
      if (error.code === '23505') {
        return NextResponse.json({ error: 'عندك كوبون بنفس الكود ده بالفعل' }, { status: 400 })
      }
      return NextResponse.json({ error: 'حصل خطأ في إنشاء الكوبون' }, { status: 500 })
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'coupon.create',
      entityType: 'coupon',
      entityId: coupon.id,
      metadata: { code: coupon.code, discountType, discountValue },
      request,
    })

    return NextResponse.json({ coupon })
  } catch (err) {
    console.error('Coupon create error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
