// المسار المفروض: app/api/admin/package-requests/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerSupabaseClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'غير مسجل دخول' }, { status: 401 })
  }

  const { data: adminRow } = await supabase
    .from('admins')
    .select('id')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (!adminRow) {
    return NextResponse.json({ error: 'مش متاح ليك الوصول' }, { status: 403 })
  }

  // teachers(full_name, phone) و teacher_packages(name, price) بيشتغلوا كـ embed تلقائي
  // لأن package_payment_requests.teacher_id و package_id بيربطوا بالجدولين دول
  const { data, error } = await supabase
    .from('package_payment_requests')
    .select(
      'id, amount, reference_number, note, status, admin_note, reviewed_at, created_at, teachers(full_name, phone), teacher_packages(name, price)'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'حصل خطأ في تحميل الطلبات' }, { status: 500 })
  }

  return NextResponse.json({ requests: data })
}
