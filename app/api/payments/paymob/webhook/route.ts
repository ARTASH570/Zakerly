import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logActivity } from '@/lib/activityLog'

// الترتيب الرسمي من توثيق Paymob لحساب الـ HMAC والتأكد إن الطلب فعلاً جاي منهم
// https://developers.paymob.com -> Transaction Processed Callback
const HMAC_FIELDS_ORDER = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
]

function getNestedValue(obj: any, path: string) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

function verifyHmac(transaction: any, receivedHmac: string): boolean {
  const concatenated = HMAC_FIELDS_ORDER.map((field) => {
    const value = getNestedValue(transaction, field)
    return value === null || value === undefined ? '' : String(value)
  }).join('')

  const calculatedHmac = crypto
    .createHmac('sha512', process.env.PAYMOB_HMAC_SECRET!)
    .update(concatenated)
    .digest('hex')

  return calculatedHmac === receivedHmac
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const receivedHmac = url.searchParams.get('hmac') || ''

    const body = await request.json()
    const transaction = body.obj

    // 1. تأكد إن الطلب فعلاً جاي من Paymob مش حد بيحاول يزور طلب دفع ناجح
    if (!verifyHmac(transaction, receivedHmac)) {
      console.error('Paymob webhook: HMAC mismatch — رفض الطلب')
      // ⚠️ مش catch block هنا، فمفيش كائن "err" فعلي - ده حدث أمني (محاولة تزوير محتملة)
      // مش خطأ برمجي، فبنستخدم captureMessage بدل captureException
      Sentry.captureMessage('Paymob webhook: HMAC mismatch - محاولة تزوير محتملة', 'warning')
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const merchantOrderId = transaction.order?.merchant_order_id
    const isSuccess = transaction.success === true

    if (!merchantOrderId) {
      return NextResponse.json({ error: 'no order id' }, { status: 400 })
    }

    // 2. جيب سجل الدفع عندنا (merchantOrderId = payment.id اللي بعتناه وقت الإنشاء)
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, student_id, course_id, coupon_id, status')
      .eq('id', merchantOrderId)
      .single()

    if (!payment) {
      return NextResponse.json({ error: 'payment not found' }, { status: 404 })
    }

    // منع معالجة نفس الدفعة مرتين لو Paymob بعت الـ webhook أكتر من مرة
    if (payment.status === 'success') {
      return NextResponse.json({ received: true })
    }

    // 3. حدّث حالة الدفع
    await supabaseAdmin
      .from('payments')
      .update({
        status: isSuccess ? 'success' : 'failed',
        provider_transaction_id: String(transaction.id),
      })
      .eq('id', payment.id)

    // 4. لو الدفع نجح، فعّل اشتراك الطالب في الكورس
    if (isSuccess) {
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
        metadata: { provider: 'paymob', courseId: payment.course_id },
      })
      await logActivity({
        userId: payment.student_id,
        userRole: 'student',
        action: 'enrollment.created',
        entityType: 'course',
        entityId: payment.course_id,
      })
    } else {
      await logActivity({
        userId: payment.student_id,
        userRole: 'student',
        action: 'payment.failure',
        entityType: 'payment',
        entityId: payment.id,
        metadata: { provider: 'paymob', courseId: payment.course_id },
      })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Paymob webhook error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
