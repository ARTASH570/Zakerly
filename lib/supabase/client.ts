import { createBrowserClient } from '@supabase/ssr'

// ⚠️ ده بيخزن الجلسة في الكوكيز (مش localStorage زي قبل كده)
// عشان السيرفر (API routes) يقدر يقرأ هوية المستخدم ويتحقق منها فعليًا
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
