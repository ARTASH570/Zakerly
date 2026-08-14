import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const videoId = params.id
  const supabase = createServerSupabaseClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'غير مسجل دخول' }, { status: 401 })
  }

  const { data: deleted, error: deleteError } = await supabase
    .from('videos')
    .delete()
    .eq('id', videoId)
    .select('id')

  if (deleteError) {
    return NextResponse.json({ error: 'حصل خطأ أثناء الحذف' }, { status: 500 })
  }

  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: 'الفيديو مش موجود أو مش بتاعك' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}