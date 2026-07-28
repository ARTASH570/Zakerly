import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { verifyRequestOrigin } from '@/lib/csrf'
import { resetPasswordSchema, validate } from '@/lib/validation'
import { logActivity } from '@/lib/activityLog'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST /api/auth/reset-password
// Body: { newPassword: string }
// ⚠️ ده بيشتغل بس لو المستخدم عنده جلسة "recovery" صالحة (جاية من رابط الإيميل)
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const supabase = createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'الرابط منتهي أو غير صحيح، اطلب رابط استعادة جديد' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = validate(resetPasswordSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    if (!(await checkRateLimit(`reset-password:${user.id}`, 5, 600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    await logActivity({
      userId: user.id,
      userRole: teacher ? 'teacher' : 'student',
      action: 'password.reset',
      request,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
