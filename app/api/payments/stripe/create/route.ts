import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { stripe } from '@/features/payments/lib/stripe'
import { requireStudent } from '@/features/auth/lib/auth'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { createPaymentSchema, validate } from '@/lib/shared/validation'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { validateAndPriceCoupon } from '@/features/payments/lib/coupons'

// POST /api/payments/stripe/create
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

    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, title, price')
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
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

    // اعمل سجل دفع "قيد الانتظار" عندنا
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        student_id: studentId,
        course_id: courseId,
        amount: finalPrice,
        original_amount: couponId ? course.price : null,
        coupon_id: couponId,
        provider: 'stripe',
        status: 'pending',
      })
      .select()
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'حصل خطأ في إنشاء عملية الدفع' }, { status: 500 })
    }

    // Stripe بياخد الدولار، فهنا لازم تحول السعر لدولار حسب سعر الصرف عندك
    // أو تخلي أسعارك بالدولار من الأساس للطلاب اللي بيدفعوا بـ Stripe
    const priceUsdCents = Math.round(finalPrice * 100) // ⚠️ عدّل التحويل حسب عملتك الفعلية

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: course.title },
            unit_amount: priceUsdCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        payment_id: payment.id, // بنستخدمه في الـ webhook عشان نلاقي الدفعة
        student_id: studentId,
        course_id: courseId,
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/student/dashboard?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/student/dashboard?payment=cancelled`,
    })

    return NextResponse.json({ checkoutUrl: session.url, paymentId: payment.id })
  } catch (err) {
    console.error('Stripe create error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
