import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET /auth/callback?code=...&type=signup|recovery
// ده اللي Supabase بيوجّه المستخدم ليه من رابط الإيميل (تأكيد حساب، استعادة كلمة سر، إلخ)
// - نظام PKCE بيبعت "كود" مؤقت لازم نبادله بجلسة دخول حقيقية هنا على السيرفر
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (code) {
    const supabase = createServerSupabaseClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // ⚠️ لازم نوجّه حسب نوع الرابط، مش على نفس الصفحة دايمًا:
  // - "recovery" (استعادة كلمة سر) لازم يودّي المستخدم لصفحة يكتب فيها
  //   كلمة سر جديدة، مش يسجّله دخول فورًا من غير ما يغيّرها
  // - "signup" (تأكيد حساب) يودّيه لصفحة تسجيل الدخول مع رسالة تأكيد واضحة
  const next =
    type === 'recovery'
      ? '/reset-password'
      : '/login?confirmed=true'

  return NextResponse.redirect(`${origin}${next}`)
}