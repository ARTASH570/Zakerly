import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { capturePaypalOrder } from '@/features/payments/lib/paypal'
import { requireStudent } from '@/features/auth/lib/auth'
import { paypalCaptureSchema, validate } from '@/lib/shared/validation'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/payments/paypal/capture
// Body: { orderId: string }
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireStudent()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { studentId } = auth

    // ⚠️ الراوت ده بيكلم PayPal API فعليًا في كل استدعاء (capturePaypalOrder) -
    // من غير حد، طالب يقدر يستدعيه بسرعة كتير مرات ويستنزف الموارد أو يخلي
    // PayPal يحظر الـ integration مؤقتًا. نفس الحد المستخدم في باقي راوتات الدفع.
    if (!(await checkRateLimit(`payment-capture:${studentId}`, 10, 300))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(paypalCaptureSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { orderId } = parsed.data

    const result = await capturePaypalOrder(orderId)

    if (!result.success || !result.paymentId) {
      return NextResponse.json({ error: 'الدفع لم يكتمل' }, { status: 400 })
    }

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, student_id, course_id, coupon_id, status')
      .eq('id', result.paymentId)
      .single()

    if (!payment) {
      return NextResponse.json({ error: 'الدفعة مش موجودة' }, { status: 404 })
    }

    // تأكد إن الدفعة دي فعلاً بتاعة الطالب اللي طالب التأكيد (مش حد بيحاول يفعّل دفعة حد تاني)
    if (payment.student_id !== studentId) {
      return NextResponse.json({ error: 'مش مسموحلك' }, { status: 403 })
    }

    if (payment.status !== 'success') {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'success', provider_transaction_id: result.captureId })
        .eq('id', payment.id)

      await supabaseAdmin.from('enrollments').upsert(
        {
          student_id: payment.student_id,
          course_id: payment.course_id,
          payment_id: payment.id,
          is_active: true,
        },
        { onConflict: 'student_id,course_id' }
      )

      if (payment.coupon_id) {
        await supabaseAdmin.rpc('redeem_coupon', {
          p_coupon_id: payment.coupon_id,
          p_student_id: payment.student_id,
          p_payment_id: payment.id,
        })
      }

      await logActivity({
        userId: payment.student_id,
        userRole: 'student',
        action: 'payment.success',
        entityType: 'payment',
        entityId: payment.id,
        metadata: { provider: 'paypal', courseId: payment.course_id },
        request,
      })
      await logActivity({
        userId: payment.student_id,
        userRole: 'student',
        action: 'enrollment.created',
        entityType: 'course',
        entityId: payment.course_id,
        request,
      })
    }

    return NextResponse.json({ success: true, courseId: payment.course_id })
  } catch (err) {
    console.error('PayPal capture error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ في تأكيد الدفع' }, { status: 500 })
  }
}
