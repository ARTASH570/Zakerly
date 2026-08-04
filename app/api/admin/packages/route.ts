import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/features/auth/lib/auth'
export const dynamic = 'force-dynamic'
// GET /api/admin/packages - كل الباقات (حتى الغير مفعّلة) + عدد المشتركين في كل واحدة
export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: packages, error } = await supabaseAdmin
      .from('teacher_packages')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'حصل خطأ في تحميل الباقات' }, { status: 500 })
    }

    const { data: subscriptions } = await supabaseAdmin
      .from('teacher_subscriptions')
      .select('package_id')
      .eq('status', 'active')

    const subscriberCounts: Record<string, number> = {}
    for (const s of subscriptions || []) {
      subscriberCounts[s.package_id] = (subscriberCounts[s.package_id] || 0) + 1
    }

    const packagesWithCounts = (packages || []).map((p) => ({
      ...p,
      subscriberCount: subscriberCounts[p.id] || 0,
    }))

    return NextResponse.json({ packages: packagesWithCounts })
  } catch (err) {
    console.error('Admin packages list error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
