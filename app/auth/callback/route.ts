import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET /auth/callback?code=...&next=/reset-password
// ده اللي Supabase بيوجّه المستخدم ليه من رابط الإيميل (تأكيد حساب، استعادة كلمة سر، إلخ)
// - نظام PKCE بيبعت "كود" مؤقت لازم نبادله بجلسة دخول حقيقية هنا على السيرفر
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/login?confirmed=true'
  if (code) {
    const supabase = createServerSupabaseClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
