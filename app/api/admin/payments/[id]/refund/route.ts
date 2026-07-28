import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/auth'
import { verifyRequestOrigin } from '@/lib/csrf'
import { logActivity } from '@/lib/activityLog'
import { refundStripePayment } from '@/lib/stripe'
import { refundPaypalPayment } from '@/lib/paypal'

// POST /api/admin/payments/[id]/refund
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, student_id, course_id, provider, provider_transaction_id, status, amount')
      .eq('id', params.id)
      .single()

    if (!payment) {
      return NextResponse.json({ error: 'الدفعة مش موجودة' }, { status: 404 })
    }

    if (payment.status === 'refunded') {
      return NextResponse.json({ error: 'الدفعة دي مستردة بالفعل' }, { status: 400 })
    }

    if (payment.status !== 'success') {
      return NextResponse.json({ error: 'مينفعش تسترد دفعة مش ناجحة' }, { status: 400 })
    }

    let manualActionRequired = false

    // 1. الاسترداد الفعلي للفلوس - حسب البوابة
    try {
      if (payment.provider === 'stripe' && payment.provider_transaction_id) {
        await refundStripePayment(payment.provider_transaction_id)
      } else if (payment.provider === 'paypal' && payment.provider_transaction_id) {
        await refundPaypalPayment(payment.provider_transaction_id)
      } else if (payment.provider === 'paymob') {
        // ⚠️ Paymob مافيهاش API استرداد بسيط بنفس نمط Intention API اللي بنستخدمه -
        // بتحتاج مصادقة قديمة مختلفة تمامًا. بنسجل الاسترداد عندنا ونوقف اشتراك
        // الطالب فورًا، لكن رد الفلوس نفسه لازم يتعمل يدوي من لوحة تحكم Paymob
        manualActionRequired = true
      }
    } catch (refundErr) {
      console.error('Refund API error:', refundErr)
      Sentry.captureException(refundErr)
      return NextResponse.json(
        { error: 'فشل الاسترداد الفعلي من بوابة الدفع، حاول تاني أو تواصل مع الدعم الفني بتاع البوابة' },
        { status: 502 }
      )
    }

    // 2. حدّث حالة الدفعة عندنا
    await supabaseAdmin.from('payments').update({ status: 'refunded' }).eq('id', payment.id)

    // 3. أوقف اشتراك الطالب في الكورس ده فورًا (منطقي: لو استردّ فلوسه، مايفضلش وصول)
    await supabaseAdmin
      .from('enrollments')
      .update({ is_active: false })
      .eq('student_id', payment.student_id)
      .eq('course_id', payment.course_id)

    await logActivity({
      userId: auth.adminId,
      userRole: 'system',
      action: 'settings.update',
      entityType: 'payment',
      entityId: payment.id,
      metadata: { action: 'refund', provider: payment.provider, amount: payment.amount, manualActionRequired },
      request,
    })

    return NextResponse.json({
      success: true,
      manualActionRequired,
      message: manualActionRequired
        ? 'تم إيقاف اشتراك الطالب - لازم تعمل الاسترداد الفعلي يدوي من لوحة تحكم Paymob'
        : 'تم رد الفلوس فعليًا وإيقاف اشتراك الطالب',
    })
  } catch (err) {
    console.error('Refund payment error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
