import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/admin/students/[id]/toggle-disable
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id, is_disabled')
      .eq('id', params.id)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'الطالب مش موجود' }, { status: 404 })
    }

    const newStatus = !student.is_disabled

    await supabaseAdmin.from('students').update({ is_disabled: newStatus }).eq('id', params.id)

    await logActivity({
      userId: auth.adminId,
      userRole: 'system',
      action: 'settings.update',
      entityType: 'student',
      entityId: params.id,
      metadata: { action: newStatus ? 'disabled' : 'enabled', by: 'admin' },
      request,
    })

    return NextResponse.json({ success: true, isDisabled: newStatus })
  } catch (err) {
    console.error('Toggle student disable error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
