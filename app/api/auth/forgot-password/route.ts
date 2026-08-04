import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { forgotPasswordSchema, validate } from '@/lib/shared/validation'

// POST /api/auth/forgot-password
// Body: { email: string }
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = validate(forgotPasswordSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { email } = parsed.data

    // حد صارم جدًا هنا - endpoint زي ده بيتستخدم كتير في هجمات سبام إيميلات
    // (حد خبيث يحط إيميل ضحية ويخليها تستقبل مئات إيميلات "استعادة كلمة السر")
    if (!(await checkRateLimit(`forgot-password:${email}`, 3, 3600))) {
      return NextResponse.json(
        { error: 'طلبت الاستعادة كتير، حاول تاني بعد ساعة' },
        { status: 429 }
      )
    }

    const supabase = createServerSupabaseClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
    })

    // ⚠️ بنرجع نفس الرسالة سواء الإيميل موجود أو لأ - عشان محدش يقدر يعرف
    // مين مسجل عندنا ومين لأ (Email Enumeration Protection)
    return NextResponse.json({
      success: true,
      message: 'لو الإيميل ده مسجل عندنا، هيوصلك رابط استعادة كلمة السر',
    })
  } catch (err) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
