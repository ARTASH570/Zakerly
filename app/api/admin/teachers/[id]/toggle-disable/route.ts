import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/auth'
import { verifyRequestOrigin } from '@/lib/csrf'
import { logActivity } from '@/lib/activityLog'

// POST /api/admin/teachers/[id]/toggle-disable
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id, is_disabled')
      .eq('id', params.id)
      .single()

    if (!teacher) {
      return NextResponse.json({ error: 'المعلم مش موجود' }, { status: 404 })
    }

    const newStatus = !teacher.is_disabled

    await supabaseAdmin.from('teachers').update({ is_disabled: newStatus }).eq('id', params.id)

    await logActivity({
      userId: auth.adminId,
      userRole: 'system',
      action: 'settings.update',
      entityType: 'teacher',
      entityId: params.id,
      metadata: { action: newStatus ? 'disabled' : 'enabled', by: 'admin' },
      request,
    })

    return NextResponse.json({ success: true, isDisabled: newStatus })
  } catch (err) {
    console.error('Toggle teacher disable error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
