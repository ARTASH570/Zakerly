import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit } from '@/lib/rateLimit'
import { verifyRequestOrigin } from '@/lib/csrf'
import { loginSchema, validate } from '@/lib/validation'
import { logActivity } from '@/lib/activityLog'

// POST /api/auth/login
// Body: { email: string, password: string }
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = validate(loginSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { email, password } = parsed.data

    // ⚠️ نحدد الحد بالإيميل + الـ IP مع بعض، عشان محدش يقدر "يجرب" باسورد كتير
    // على إيميل واحد بالذات (brute-force) حتى لو غيّر IP، والعكس صحيح
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    if (!(await checkRateLimit(`login:${email}`, 5, 300))) {
      return NextResponse.json(
        { error: 'محاولات كتير غلط، حاول تاني بعد 5 دقايق' },
        { status: 429 }
      )
    }
    if (!(await checkRateLimit(`login-ip:${ip}`, 20, 300))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user) {
      // رسالة عامة من غير ما نوضح "الإيميل مش موجود" أو "الباسورد غلط" تحديدًا
      // عشان محدش يقدر يستخدم رسالة الخطأ عشان يعرف إيميلات مسجلة فعليًا (enumeration)
      return NextResponse.json({ error: 'الإيميل أو كلمة السر غلط' }, { status: 401 })
    }

    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id, is_disabled')
      .eq('id', data.user.id)
      .maybeSingle()

    // ⚠️ لو الحساب معطّل من الأدمن، نرفض الدخول فورًا ونمسح الجلسة اللي اتفتحت
    // لتوها (signInWithPassword بيفتح جلسة صحيحة قبل ما نتحقق من is_disabled)
    const { data: student } = teacher
      ? { data: null }
      : await supabaseAdmin.from('students').select('id, is_disabled').eq('id', data.user.id).maybeSingle()

    const account = teacher || student
    if (account?.is_disabled) {
      await supabase.auth.signOut()
      return NextResponse.json({ error: 'حسابك متوقف حاليًا، تواصل مع الدعم' }, { status: 403 })
    }

    await logActivity({
      userId: data.user.id,
      userRole: teacher ? 'teacher' : 'student',
      action: 'login',
      request,
    })

    return NextResponse.json({ success: true, userId: data.user.id })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
