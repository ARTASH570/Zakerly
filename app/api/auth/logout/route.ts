import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyRequestOrigin } from '@/lib/csrf'
import { logActivity } from '@/lib/activityLog'

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

      await logActivity({
        userId: user.id,
        userRole: teacher ? 'teacher' : 'student',
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
