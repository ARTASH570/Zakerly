import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createPaymobIntention, getPaymobCheckoutUrl } from '@/lib/paymob'
import { requireStudent } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { createPaymentSchema, validate } from '@/lib/validation'
import { verifyRequestOrigin } from '@/lib/csrf'
import { validateAndPriceCoupon } from '@/lib/coupons'

// POST /api/payments/paymob/create
// Body: { courseId: string }
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    // ⚠️ التحقق الحقيقي: بنجيب هوية الطالب من جلسة الدخول المتحقق منها، مش من الطلب
    const auth = await requireStudent()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { studentId } = auth

    // منع حد يبعت عشرات طلبات الدفع في ثواني (بيعمل سجلات فاضية أو بيضغط على Paymob)
    if (!(await checkRateLimit(`payment-create:${studentId}`, 5, 60))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(createPaymentSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { courseId, couponCode } = parsed.data

    // 1. هات بيانات الكورس والطالب من قاعدة البيانات
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, title, price')
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      return NextResponse.json({ error: 'الكورس مش موجود' }, { status: 404 })
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, full_name')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: 'الطالب مش موجود' }, { status: 404 })
    }

    // منع الاشتراك المكرر في نفس الكورس
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

    // لو الطالب دخل كود كوبون، نتحقق منه ونحسب السعر النهائي بعد الخصم
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

    // 2. اعمل سجل دفع "قيد الانتظار" عندنا الأول
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        student_id: studentId,
        course_id: courseId,
        amount: finalPrice,
        original_amount: couponId ? course.price : null,
        coupon_id: couponId,
        provider: 'paymob',
        status: 'pending',
      })
      .select()
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'حصل خطأ في إنشاء عملية الدفع' }, { status: 500 })
    }

    // 3. اطلب من Paymob "نية دفع" (Intention) واحصل على رابط صفحة الدفع
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(studentId)

    const { clientSecret } = await createPaymobIntention({
      amountCents: Math.round(finalPrice * 100), // Paymob بياخد المبلغ بالقروش
      merchantOrderId: payment.id, // بنربط الدفعة برقمها عندنا عشان نلاقيها في الـ webhook
      customerName: student.full_name,
      customerEmail: authUser?.user?.email || 'student@example.com',
      customerPhone: '',
    })

    const checkoutUrl = getPaymobCheckoutUrl(clientSecret)

    return NextResponse.json({ checkoutUrl, paymentId: payment.id })
  } catch (err) {
    console.error('Paymob create error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
