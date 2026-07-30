import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { verifyPaypalWebhookSignature } from '@/features/payments/lib/paypal'

export async function POST(request: Request) {
  try {
    const rawBody = await request.text() // لازم النص الخام عشان التحقق من التوقيع يشتغل صح

    // 1. تأكد إن الطلب فعلاً جاي من PayPal مش حد بيحاول يزوّر إشعار دفع ناجح
    const isValid = await verifyPaypalWebhookSignature(request.headers, rawBody)
    if (!isValid) {
      console.error('PayPal webhook: توقيع غير صحيح — رفض الطلب')
      // ⚠️ مش catch block هنا، فمفيش كائن "err" فعلي - ده حدث أمني (محاولة تزوير محتملة)
      Sentry.captureMessage('PayPal webhook: توقيع غير صحيح - محاولة تزوير محتملة', 'warning')
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody)

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const paymentId = event.resource?.custom_id // ده رقم الدفعة عندنا اللي بعتناه وقت الإنشاء

      if (!paymentId) {
        return NextResponse.json({ received: true })
      }

      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('id, student_id, course_id, coupon_id, status')
        .eq('id', paymentId)
        .single()

      // منع معالجة نفس الدفعة مرتين (لو صفحة الرجوع أصلاً نجحت في التفعيل قبل الـ webhook)
      if (payment && payment.status !== 'success') {
        await supabaseAdmin
          .from('payments')
          .update({ status: 'success', provider_transaction_id: event.resource.id })
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

        // لو الدفعة دي استخدمت كوبون، أكّد استخدامه دلوقتي (الدالة atomic
        // وبترفض بأمان لو حصل تعارض نادر - الاشتراك بيتفعّل برضه لأن الفلوس اتاخدت فعليًا)
        if (payment.coupon_id) {
          await supabaseAdmin.rpc('redeem_coupon', {
            p_coupon_id: payment.coupon_id,
            p_student_id: payment.student_id,
            p_payment_id: payment.id,
          })
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('PayPal webhook error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
