import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { promoteAdminSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'

// GET /api/admin/admins
export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: admins } = await supabaseAdmin
      .from('admins')
      .select('id, full_name, email, created_at')
      .order('created_at', { ascending: true })

    return NextResponse.json({ admins: admins || [], currentAdminId: auth.adminId })
  } catch (err) {
    console.error('Admins list error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}

// POST /api/admin/admins - ترقية مستخدم موجود (سجل حساب طالب أو معلم عادي) لأدمن
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { adminId } = auth

    if (!(await checkRateLimit(`admin-promote:${adminId}`, 10, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(promoteAdminSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { email, fullName } = parsed.data

    // 1. لازم يكون فيه حساب مسجل بالإيميل ده أصلًا (المستخدم يعمل تسجيل عادي الأول)
    const { data: userId } = await supabaseAdmin.rpc('find_user_id_by_email', { p_email: email })
    if (!userId) {
      return NextResponse.json(
        { error: 'مفيش حساب مسجل بالإيميل ده. المستخدم لازم يعمل تسجيل عادي (كمعلم أو طالب) الأول' },
        { status: 404 }
      )
    }

    // 2. لو أدمن بالفعل
    const { data: existingAdmin } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (existingAdmin) {
      return NextResponse.json({ error: 'الحساب ده أدمن بالفعل' }, { status: 400 })
    }

    // 3. هات الاسم من جدول المعلم أو الطالب لو موجود ومفيش fullName متبعت صريح
    let resolvedName = fullName
    if (!resolvedName) {
      const { data: teacherRow } = await supabaseAdmin
        .from('teachers')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle()
      const { data: studentRow } = await supabaseAdmin
        .from('students')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle()
      resolvedName = teacherRow?.full_name || studentRow?.full_name || email.split('@')[0]
    }

    const { data: newAdmin, error } = await supabaseAdmin
      .from('admins')
      .insert({ id: userId, full_name: resolvedName, email })
      .select()
      .single()

    if (error || !newAdmin) {
      return NextResponse.json({ error: 'حصل خطأ في الترقية' }, { status: 500 })
    }

    await logActivity({
      userId: adminId,
      userRole: 'admin',
      action: 'admin.promote',
      entityType: 'admin',
      entityId: newAdmin.id,
      metadata: { email },
      request,
    })

    return NextResponse.json({ admin: newAdmin })
  } catch (err) {
    console.error('Admin promote error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
