import { supabaseAdmin } from '@/lib/supabase/admin'

interface CouponCheckResult {
  valid: true
  couponId: string
  finalPrice: number
  originalPrice: number
}

interface CouponCheckError {
  valid: false
  error: string
}

/**
 * بتتحقق من كوبون معين وتحسب السعر النهائي بعد الخصم - بتُستخدم في كل بوابات
 * الدفع التلاتة (Paymob, Stripe, PayPal) عشان مانكررش نفس المنطق تلات مرات.
 *
 * ⚠️ التحقق هنا للعرض والتسعير بس (وقت إنشاء الدفعة). التأكيد النهائي الفعلي
 * (زيادة العداد + تسجيل الاستخدام) بيحصل بس وقت نجاح الدفع الفعلي عن طريق
 * دالة redeem_coupon الـ atomic في قاعدة البيانات - عشان نضمن مفيش Race Condition.
 */
export async function validateAndPriceCoupon(
  code: string,
  courseId: string,
  coursePrice: number,
  studentId: string
): Promise<CouponCheckResult | CouponCheckError> {
  const { data: coupon } = await supabaseAdmin
    .from('coupons')
    .select('*')
    .ilike('code', code.trim())
    .eq('is_active', true)
    .maybeSingle()

  if (!coupon) {
    return { valid: false, error: 'كود الخصم غير صحيح' }
  }

  // الكوبون ده بتاع كورس معين ومش الكورس اللي الطالب بيحاول يدفع فيه
  if (coupon.course_id && coupon.course_id !== courseId) {
    return { valid: false, error: 'الكوبون ده مش صالح للكورس ده' }
  }

  // ⚠️ نتأكد إن الكوبون بتاع نفس المعلم صاحب الكورس (حماية إضافية حتى لو
  // coupon.course_id فاضي/عام - مايشتغلش على كورسات معلم تاني بالغلط)
  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('teacher_id')
    .eq('id', courseId)
    .single()

  if (!course || course.teacher_id !== coupon.teacher_id) {
    return { valid: false, error: 'الكوبون ده مش صالح للكورس ده' }
  }

  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
    return { valid: false, error: 'الكوبون ده منتهي' }
  }

  if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, error: 'الكوبون ده وصل للحد الأقصى من الاستخدام' }
  }

  if (coupon.min_price !== null && coursePrice < coupon.min_price) {
    return { valid: false, error: `الكوبون ده شغال بس على كورسات سعرها ${coupon.min_price} أو أكتر` }
  }

  if (coupon.one_time_per_student) {
    const { data: existingRedemption } = await supabaseAdmin
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('student_id', studentId)
      .maybeSingle()

    if (existingRedemption) {
      return { valid: false, error: 'انت مستخدم الكوبون ده قبل كده' }
    }
  }

  const finalPrice =
    coupon.discount_type === 'percentage'
      ? Math.max(0, coursePrice * (1 - Number(coupon.discount_value) / 100))
      : Math.max(0, coursePrice - Number(coupon.discount_value))

  return {
    valid: true,
    couponId: coupon.id,
    finalPrice: Math.round(finalPrice * 100) / 100,
    originalPrice: coursePrice,
  }
}
