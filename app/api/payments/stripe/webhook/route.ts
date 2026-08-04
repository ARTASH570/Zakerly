import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { stripe } from '@/features/payments/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/shared/activityLog'

export async function POST(request: Request) {
  const body = await request.text() // لازم النص الخام (مش JSON متحول) عشان التحقق من التوقيع
  const signature = request.headers.get('stripe-signature') || ''

  let event
  try {
    // التحقق إن الطلب فعلاً جاي من Stripe مش حد بيحاول يزور رد دفع ناجح
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Stripe webhook: توقيع غير صحيح', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const { payment_id, student_id, course_id } = session.metadata

    // منع معالجة نفس الدفعة مرتين
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('status, coupon_id')
      .eq('id', payment_id)
      .single()

    if (payment?.status === 'success') {
      return NextResponse.json({ received: true })
    }

    await supabaseAdmin
      .from('payments')
      .update({
        status: 'success',
        provider_transaction_id: session.id,
      })
      .eq('id', payment_id)

    await supabaseAdmin.from('enrollments').upsert(
      {
        student_id,
        course_id,
        payment_id,
        is_active: true,
      },
      { onConflict: 'student_id,course_id' }
    )

    if (payment?.coupon_id) {
      await supabaseAdmin.rpc('redeem_coupon', {
        p_coupon_id: payment.coupon_id,
        p_student_id: student_id,
        p_payment_id: payment_id,
      })
    }

    await logActivity({
      userId: student_id,
      userRole: 'student',
      action: 'payment.success',
      entityType: 'payment',
      entityId: payment_id,
      metadata: { provider: 'stripe', courseId: course_id },
    })
    await logActivity({
      userId: student_id,
      userRole: 'student',
      action: 'enrollment.created',
      entityType: 'course',
      entityId: course_id,
    })
  }

  return NextResponse.json({ received: true })
}
