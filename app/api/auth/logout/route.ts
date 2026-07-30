import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/auth/logout
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const supabase = createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: teacher } = await supabaseAdmin
        .from('teachers')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      const { data: student } = teacher
        ? { data: null }
        : await supabaseAdmin.from('students').select('id').eq('id', user.id).maybeSingle()

      const { data: admin } = teacher || student
        ? { data: null }
        : await supabaseAdmin.from('admins').select('id').eq('id', user.id).maybeSingle()

      await logActivity({
        userId: user.id,
        userRole: teacher ? 'teacher' : student ? 'student' : admin ? 'admin' : 'student',
        action: 'logout',
        request,
      })
    }

    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Logout error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
