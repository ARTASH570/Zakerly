import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/videos/[id]/duplicate
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireTeacher()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { teacherId } = auth

    if (!(await checkRateLimit(`video-duplicate:${teacherId}`, 30, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    // تأكد إن الفيديو الأصلي فعلاً في كورس بتاع المعلم ده
    const { data: originalVideo } = await supabaseAdmin
      .from('videos')
      .select('*, courses!inner(teacher_id)')
      .eq('id', params.id)
      .single()

    if (!originalVideo || (originalVideo as any).courses.teacher_id !== teacherId) {
      return NextResponse.json({ error: 'الفيديو مش موجود' }, { status: 404 })
    }

    const { data: maxOrder } = await supabaseAdmin
      .from('videos')
      .select('order_index')
      .eq('course_id', originalVideo.course_id)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: newVideo, error } = await supabaseAdmin
      .from('videos')
      .insert({
        course_id: originalVideo.course_id,
        section_id: originalVideo.section_id, // يفضل في نفس القسم اللي هو فيه
        title: `${originalVideo.title} (نسخة)`,
        bunny_video_id: originalVideo.bunny_video_id, // نفس الفيديو المرفوع، من غير رفع جديد
        duration_seconds: originalVideo.duration_seconds,
        order_index: (maxOrder?.order_index || 0) + 1,
      })
      .select()
      .single()

    if (error || !newVideo) {
      return NextResponse.json({ error: 'حصل خطأ في تكرار الفيديو' }, { status: 500 })
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'video.upload',
      entityType: 'video',
      entityId: newVideo.id,
      metadata: { duplicatedFrom: params.id },
      request,
    })

    return NextResponse.json({ video: newVideo })
  } catch (err) {
    console.error('Video duplicate error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
