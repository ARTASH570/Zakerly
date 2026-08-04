import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { logActivity } from '@/lib/shared/activityLog'

// DELETE /api/admin/admins/[id]
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { adminId } = auth

    if (params.id === adminId) {
      return NextResponse.json({ error: 'مينفعش تشيل صلاحية الأدمن بتاعتك انت بنفسك' }, { status: 400 })
    }

    const { count } = await supabaseAdmin.from('admins').select('id', { count: 'exact', head: true })
    if ((count || 0) <= 1) {
      return NextResponse.json({ error: 'لازم يفضل أدمن واحد على الأقل في المنصة' }, { status: 400 })
    }

    const { data: target } = await supabaseAdmin.from('admins').select('id').eq('id', params.id).maybeSingle()
    if (!target) {
      return NextResponse.json({ error: 'الأدمن ده مش موجود' }, { status: 404 })
    }

    await supabaseAdmin.from('admins').delete().eq('id', params.id)

    await logActivity({
      userId: adminId,
      userRole: 'admin',
      action: 'admin.remove',
      entityType: 'admin',
      entityId: params.id,
      request,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin remove error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
