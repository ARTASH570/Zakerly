import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * بننشئ عميل Supabase مربوط بالكوكيز بتاعة الطلب الحالي.
 * ده اللي بيخلي `supabase.auth.getUser()` جوه أي API route يرجع
 * المستخدم الحقيقي اللي عامل تسجيل دخول فعليًا - بعد ما Supabase
 * نفسه يتحقق من صحة الـ JWT بتاعه، مش مجرد قراءة قيمة من الطلب.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // بيحصل لما نحاول نعدل كوكي من جوه Server Component بدل Route Handler، مش مشكلة هنا
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {}
        },
      },
    }
  )
}
