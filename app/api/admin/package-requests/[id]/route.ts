// المسار المفروض: app/api/admin/package-requests/[id]/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const requestId = params.id
  const supabase = createServerSupabaseClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'غير مسجل دخول' }, { status: 401 })
  }

  let body: { action?: 'approve' | 'reject'; note?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
  }

  if (body.action === 'approve') {
    const { data, error } = await supabase.rpc('approve_package_request', {
      p_request_id: requestId,
    })
    if (error) {
      return NextResponse.json({ error: error.message || 'حصل خطأ' }, { status: 403 })
    }
    if (!data) {
      return NextResponse.json({ error: 'الطلب ده اتراجع عليه قبل كده' }, { status: 409 })
    }
    return NextResponse.json({ success: true })
  }

  if (body.action === 'reject') {
    const { data, error } = await supabase.rpc('reject_package_request', {
      p_request_id: requestId,
      p_note: body.note || null,
    })
    if (error) {
      return NextResponse.json({ error: error.message || 'حصل خطأ' }, { status: 403 })
    }
    if (!data) {
      return NextResponse.json({ error: 'الطلب ده اتراجع عليه قبل كده' }, { status: 409 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'action غير معروف' }, { status: 400 })
}
