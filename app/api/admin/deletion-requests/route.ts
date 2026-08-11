// المسار المفروض: app/api/admin/deletion-requests/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()

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

  // teachers(full_name) بيشتغل كـ embed تلقائي لأن deletion_requests.teacher_id بيربط بـ teachers.id
  const { data, error } = await supabase
    .from('deletion_requests')
    .select('id, course_id, course_title, reason, enrolled_count, total_paid, status, admin_note, reviewed_at, created_at, teachers(full_name)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'حصل خطأ في تحميل الطلبات' }, { status: 500 })
  }

  return NextResponse.json({ requests: data })
}
