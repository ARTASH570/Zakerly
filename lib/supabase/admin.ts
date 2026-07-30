import { createClient } from '@supabase/supabase-js'

// ⚠️ ده بيستخدم الـ service role key، متستخدمهوش غير في السيرفر (API routes)
// لأنه بيتخطى كل الـ Row Level Security
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
)
