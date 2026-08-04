import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { registerSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/auth/register
// Body: { email, password, fullName, role, parentPhone? }
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = validate(registerSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { email, password, fullName, role, parentPhone } = parsed.data

    if (role === 'student' && !parentPhone) {
      return NextResponse.json({ error: 'رقم تليفون ولي الأمر مطلوب' }, { status: 400 })
    }

    // بحد الـ IP بس هنا (مش بالإيميل، لأن كل تسجيل إيميله مختلف أصلًا)
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    if (!(await checkRateLimit(`register-ip:${ip}`, 5, 3600))) {
      return NextResponse.json(
        { error: 'وصلت للحد الأقصى من محاولات التسجيل، حاول بعد شوية' },
        { status: 429 }
      )
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error || !data.user) {
      console.error('Supabase signUp error:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
      })
      Sentry.captureMessage(`Register failed: ${error?.message}`, 'warning')
      return NextResponse.json(
        { error: error?.message ? String(error.message) : 'فشل التسجيل، حاول تاني' },
        { status: 400 }
      )
    }

    // بنستخدم service role هنا فقط لإنشاء صف البروفايل الأولي - آمن لأن الـ ID جاي من Supabase نفسه بعد التحقق
    const table = role === 'teacher' ? 'teachers' : 'students'
    const extraFields = role === 'student' ? { parent_phone: parentPhone } : {}

    const { error: profileError } = await supabaseAdmin.from(table).insert({
      id: data.user.id,
      full_name: fullName,
      ...extraFields,
    })

    if (profileError) {
      // ⚠️ لو فشل إنشاء صف البروفايل بعد ما نجح إنشاء حساب auth.users، لازم
      // نرجع بالحالة زي ما كانت (rollback) - وإلا هيفضل حساب "معلّق" قادر
      // يسجل دخول لكن من غير أي دور (مش معلم ولا طالب)، وحالته هتبقى معطوبة.
      console.error('Profile insert failed after signUp, rolling back auth user:', profileError)
      Sentry.captureMessage(`Register rollback: profile insert failed for ${data.user.id}`, 'error')
      await supabaseAdmin.auth.admin.deleteUser(data.user.id)
      return NextResponse.json({ error: 'حصل خطأ في إنشاء الحساب' }, { status: 500 })
    }

    await logActivity({
      userId: data.user.id,
      userRole: role,
      action: 'register',
      metadata: { email },
      request,
    })

    return NextResponse.json({ success: true, userId: data.user.id })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
