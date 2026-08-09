import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireStudent } from '@/features/auth/lib/auth'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { validateAndPriceCoupon } from '@/features/payments/lib/coupons'
import { egpToUsdCents } from '@/features/payments/lib/currency'

// POST /api/payments/coupons/preview
// Body: { courseId: string, couponCode: string }
//
// ⚠️ ده بس للعرض في الواجهة (يوري الطالب السعر بعد الخصم فورًا وهو لسه
// بيكتب الكود، قبل ما يدوس على زرار الدفع). التحقق الحقيقي والنهائي بيتكرر
// تاني جوه كل route من routes الدفع (paypal/paymob/stripe) وقت إنشاء
// الدفعة فعليًا - عشان محدش يقدر "يزوّر" رد الـ preview ده ويدفع بسعر أقل.
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

    if (!(await checkRateLimit(`coupon-preview:${studentId}`, 20, 60))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const { courseId, couponCode } = body as { courseId?: string; couponCode?: string }

    if (!courseId  !couponCode  typeof couponCode !== 'string') {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id, price')
      .eq('id', courseId)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'الكورس مش موجود' }, { status: 404 })
    }

    const result = await validateAndPriceCoupon(couponCode, courseId, course.price, studentId)

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error })
    }

    let finalPriceUsd: number | null = null
    try {
      const cents = await egpToUsdCents(result.finalPrice)
      finalPriceUsd = Math.round((cents / 100) * 100) / 100
    } catch {
      // لو التحويل فشل، هنسيب finalPriceUsd null
    }

    return NextResponse.json({
      valid: true,
      originalPrice: result.originalPrice,
      finalPrice: result.finalPrice,
      finalPriceUsd,
    })
  } catch (err) {
    console.error('Coupon preview error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}