import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { reorderVideosSchema, validate } from '@/lib/shared/validation'

// POST /api/videos/reorder
// Body: { courseId, orderedVideoIds: string[] } - بالترتيب الجديد اللي المعلم عمله بالسحب
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireTeacher()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { teacherId } = auth

    if (!(await checkRateLimit(`video-reorder:${teacherId}`, 60, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(reorderVideosSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { courseId, orderedVideoIds } = parsed.data

    // تأكد إن الكورس ده فعلاً بتاع المعلم اللي طالب إعادة الترتيب
    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('teacher_id', teacherId)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'مش مسموحلك' }, { status: 403 })
    }

    // تحقق أمان إضافي: تأكد إن كل الفيديوهات المبعوتة فعلاً من نفس الكورس
    // (يمنع محاولة خبيثة لإعادة ترتيب فيديو من كورس تاني عن طريق تمرير الـ ID بتاعه)
    const { count } = await supabaseAdmin
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', courseId)
      .in('id', orderedVideoIds)

    if (count !== orderedVideoIds.length) {
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 })
    }

    // ⚠️ استدعاء دالة atomic في قاعدة البيانات بدل N تحديثات منفصلة -
    // التحديث كله بينفذ في عملية واحدة، إما ينجح كامل أو يفشل كامل
    const { error } = await supabaseAdmin.rpc('reorder_videos', {
      p_video_ids: orderedVideoIds,
    })

    if (error) {
      return NextResponse.json({ error: 'حصل خطأ في إعادة الترتيب' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Video reorder error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
