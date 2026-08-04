// حماية CSRF بسيطة وفعالة: بنتأكد إن الطلب جاي فعليًا من موقعنا نفسه
// (عن طريق مقارنة Origin/Referer بالدومين بتاعنا)، مش من موقع تاني حاول
// يستغل جلسة دخول المستخدم من غير علمه.
//
// ليه الطريقة دي بدل CSRF Token التقليدي؟
// إحنا أصلاً بنستخدم كوكيز الجلسة بتاعة Supabase اللي بتتحط بـ SameSite=Lax،
// وده بيمنع المتصفح يبعت الكوكي في طلبات POST من مواقع تانية من الأساس.
// التحقق من Origin هنا طبقة حماية إضافية (Defense in Depth) بسيطة وموثوقة
// من غير ما نحتاج نضيف تعقيد token generation/rotation لكل فورم في الموقع.

export function verifyRequestOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  // ⚠️ قبل كده لو المتغير مش متظبط كنا بنرجع true (يعني نعطّل حماية CSRF بالكامل
  // من غير ما حد يلاحظ). فشل بصمت زي ده أخطر من فشل صريح - دلوقتي بنرفض الطلب
  // ونسجل تحذير واضح، عشان أي نسيان في إعداد الـ env vars وقت الإطلاق يبان فورًا
  // (الطلبات هتفشل بوضوح) بدل ما يفضل موجود كثغرة صامتة.
  if (!siteUrl) {
    console.error(
      '[csrf] NEXT_PUBLIC_SITE_URL مش متظبط - رافضين كل الطلبات اللي محتاجة تحقق Origin لحد ما يتظبط'
    )
    return false
  }

  // بعض الطلبات (زي الـ webhooks من Paymob/Stripe/PayPal) مالهاش Origin header
  // أصلاً لأنها server-to-server، فبنستثنيها من التحقق ده تحديدًا (بتتحقق بطريقة تانية: HMAC/توقيع)
  if (!origin) return false

  try {
    const originHost = new URL(origin).host
    const siteHost = new URL(siteUrl).host
    return originHost === siteHost
  } catch {
    return false
  }
}
