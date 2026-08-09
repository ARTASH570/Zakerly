import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createPaypalOrder } from '@/features/payments/lib/paypal'
import { requireStudent } from '@/features/auth/lib/auth'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { createPaymentSchema, validate } from '@/lib/shared/validation'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { validateAndPriceCoupon } from '@/features/payments/lib/coupons'
import { egpToUsdCents } from '@/features/payments/lib/currency'

// POST /api/payments/paypal/create
// Body: { courseId: string }
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

    if (!(await checkRateLimit(`payment-create:${studentId}`, 5, 60))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(createPaymentSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { courseId, couponCode } = parsed.data

    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id, price')
      .eq('id', courseId)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'الكورس مش موجود' }, { status: 404 })
    }

    const { data: existingEnrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .eq('is_active', true)
      .maybeSingle()

    if (existingEnrollment) {
      return NextResponse.json({ error: 'انت مشترك في الكورس ده بالفعل' }, { status: 400 })
    }

    let finalPrice = course.price
    let couponId: string | null = null

    if (couponCode) {
      const couponResult = await validateAndPriceCoupon(couponCode, courseId, course.price, studentId)
      if (!couponResult.valid) {
        return NextResponse.json({ error: couponResult.error }, { status: 400 })
      }
      finalPrice = couponResult.finalPrice
      couponId = couponResult.couponId
    }

    // PayPal بياخد الدولار بس، والسعر عندنا محسوب بالجنيه - لازم تحويل حقيقي
    // (كان فيه هنا باگ: السعر بالجنيه كان بيتبعت 1:1 كأنه دولار). بنتحقق من
    // ده الأول قبل ما نعمل سجل دفع "pending"، عشان لو فشل التحويل منسيبش
    // صف يتيم في جدول payments من غير أي order حقيقي وراه
    let priceUsd: number
    try {
      priceUsd = await egpToUsdCents(finalPrice) / 100
    } catch (conversionErr) {
      console.error('PayPal create: currency conversion error', conversionErr)
      Sentry.captureException(conversionErr)
      return NextResponse.json(
        { error: 'الدفع بالدولار مش متاح دلوقتي، جرب وسيلة دفع تانية' },
        { status: 503 }
      )
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        student_id: studentId,
        course_id: courseId,
        amount: finalPrice,
        original_amount: couponId ? course.price : null,
        coupon_id: couponId,
        provider: 'paypal',
        status: 'pending',
      })
      .select()
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'حصل خطأ في إنشاء عملية الدفع' }, { status: 500 })
    }

    const { approveUrl } = await createPaypalOrder(priceUsd, payment.id)

    return NextResponse.json({ checkoutUrl: approveUrl, paymentId: payment.id })
  } catch (err) {
    console.error('PayPal create error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
