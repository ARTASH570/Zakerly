import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { toggleMaintenanceSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'

// GET /api/admin/settings/maintenance - حالة الصيانة الحالية
export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: settings } = await supabaseAdmin
      .from('platform_settings')
      .select('maintenance_mode, maintenance_message, updated_at')
      .eq('id', true)
      .maybeSingle()

    return NextResponse.json({
      maintenanceMode: settings?.maintenance_mode ?? false,
      maintenanceMessage: settings?.maintenance_message ?? '',
      updatedAt: settings?.updated_at ?? null,
    })
  } catch (err) {
    console.error('Maintenance settings fetch error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}

// POST /api/admin/settings/maintenance - تفعيل/إيقاف وضع الصيانة
// لما يتفعّل: كل المستخدمين (معلمين وطلاب) بيتحوّلوا لصفحة "تحت الصيانة"
// عدا الأدمن، وده بيتحقق منه في middleware.ts على مستوى المنصة كلها
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

    if (!(await checkRateLimit(`maintenance-toggle:${adminId}`, 20, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(toggleMaintenanceSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { enabled, message } = parsed.data

    const updates: Record<string, unknown> = {
      maintenance_mode: enabled,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    }
    if (message !== undefined && message !== null) updates.maintenance_message = message

    const { data: updated, error } = await supabaseAdmin
      .from('platform_settings')
      .update(updates)
      .eq('id', true)
      .select()
      .single()

    if (error || !updated) {
      return NextResponse.json({ error: 'حصل خطأ في تحديث الإعدادات' }, { status: 500 })
    }

    await logActivity({
      userId: adminId,
      userRole: 'admin',
      action: 'maintenance.toggle',
      entityType: 'platform_settings',
      metadata: { enabled },
      request,
    })

    return NextResponse.json({
      maintenanceMode: updated.maintenance_mode,
      maintenanceMessage: updated.maintenance_message,
    })
  } catch (err) {
    console.error('Maintenance toggle error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
