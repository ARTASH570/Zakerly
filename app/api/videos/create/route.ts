import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createBunnyVideo, generateTusUploadCredentials } from '@/features/videos/lib/bunny'
import { requireTeacher } from '@/features/auth/lib/auth'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { createVideoSchema, validate } from '@/lib/shared/validation'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/videos/create
// Body: { courseId: string, sectionId: string, title: string }
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

    // كل عملية رفع بتكلفنا فلوس فعلية على Bunny، فبنحدد حد معقول في الساعة
    if (!(await checkRateLimit(`video-create:${teacherId}`, 20, 3600))) {
      return NextResponse.json({ error: 'وصلت للحد الأقصى من الرفع الساعة، حاول بعدين' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(createVideoSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { courseId, sectionId, title } = parsed.data

    // 1. تأكد إن الكورس ده فعلاً بتاع المعلم اللي طالب الرفع
    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id, teacher_id')
      .eq('id', courseId)
      .single()

    if (!course || course.teacher_id !== teacherId) {
      return NextResponse.json({ error: 'مش مسموحلك ترفع فيديو للكورس ده' }, { status: 403 })
    }

    // ⚠️ تحقق تطبيقي (App Layer) إن القسم ده فعلاً بتاع نفس الكورس - رسالة خطأ واضحة
    // للمستخدم بدل ما ننتظر قاعدة البيانات ترفض الطلب برسالة تقنية غير مفهومة.
    // الضمان الحقيقي ضد أي تعارض هو الـ Composite Foreign Key في قاعدة البيانات نفسها.
    const { data: section } = await supabaseAdmin
      .from('sections')
      .select('id, course_id')
      .eq('id', sectionId)
      .single()

    if (!section || section.course_id !== courseId) {
      return NextResponse.json({ error: 'القسم ده مش تابع للكورس ده' }, { status: 400 })
    }

    // 2. اعمل الفيديو على Bunny واحصل على الـ GUID بتاعه
    const bunnyVideoId = await createBunnyVideo(title)

    // ⚠️ لازم نحسب order_index يدوي هنا - من غيره كل فيديو جديد بياخد القيمة
    // الافتراضية 0 من قاعدة البيانات، فكل فيديوهات القسم بتتساوى في الترتيب
    // وترتيب عرضهم للطالب بيبقى غير موثوق (نفس الباترن المستخدم في sections/create)
    const { data: maxOrder } = await supabaseAdmin
      .from('videos')
      .select('order_index')
      .eq('section_id', sectionId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 3. سجّل الفيديو عندنا (لسه من غير محتوى، هيتحدث تلقائي أول ما الرفع يخلص)
    const { data: video, error: videoError } = await supabaseAdmin
      .from('videos')
      .insert({
        course_id: courseId,
        section_id: sectionId,
        title,
        bunny_video_id: bunnyVideoId,
        order_index: (maxOrder?.order_index ?? -1) + 1,
      })
      .select()
      .single()

    if (videoError || !video) {
      return NextResponse.json({ error: 'حصل خطأ في حفظ الفيديو' }, { status: 500 })
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'video.upload',
      entityType: 'video',
      entityId: video.id,
      metadata: { courseId, sectionId, title },
      request,
    })

    // 4. جهّز بيانات الرفع المباشر (TUS) عشان المتصفح يرفع الفيديو مباشرة لـ Bunny
    const uploadCredentials = generateTusUploadCredentials(bunnyVideoId)

    return NextResponse.json({
      videoRecordId: video.id,
      ...uploadCredentials,
    })
  } catch (err) {
    console.error('Video create error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
