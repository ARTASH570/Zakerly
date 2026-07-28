import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/overview
export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: teachers } = await supabaseAdmin
      .from('teachers')
      .select('id, full_name, subject, is_disabled, created_at')
      .order('created_at', { ascending: false })

    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, full_name, parent_phone, is_disabled, created_at')
      .order('created_at', { ascending: false })

    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('id, student_id, course_id, amount, provider, status, created_at, students(full_name), courses(title)')
      .order('created_at', { ascending: false })
      .limit(50)

    const { data: recentActivity } = await supabaseAdmin
      .from('activity_logs')
      .select('id, user_role, action, entity_type, entity_id, created_at')
      .order('created_at', { ascending: false })
      .limit(30)

    const totalRevenue = (payments || [])
      .filter((p) => p.status === 'success')
      .reduce((sum, p) => sum + Number(p.amount), 0)

    return NextResponse.json({
      totalTeachers: teachers?.length || 0,
      totalStudents: students?.length || 0,
      totalRevenue,
      teachers: teachers || [],
      students: students || [],
      payments: payments || [],
      recentActivity: recentActivity || [],
    })
  } catch (err) {
    console.error('Admin overview error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
