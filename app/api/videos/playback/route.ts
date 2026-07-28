import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateSecureEmbedUrl } from '@/lib/bunny'
import { requireStudent } from '@/lib/auth'
import { videoPlaybackSchema, validate } from '@/lib/validation'
import { verifyRequestOrigin } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rateLimit'

// POST /api/videos/playback
// Body: { videoId: string }
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireStudent()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { studentId } = auth

    // بيمنع سكريبت آلي يحاول يطلب مئات روابط المشاهدة بسرعة (حتى لو كل رابط بيتحقق من الاشتراك أصلًا)
    if (!(await checkRateLimit(`video-playback:${studentId}`, 30, 60))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(videoPlaybackSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { videoId } = parsed.data

    // 1. هات الفيديو ومعاه الكورس بتاعه
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('id, bunny_video_id, course_id')
      .eq('id', videoId)
      .single()

    if (!video) {
      return NextResponse.json({ error: 'الفيديو مش موجود' }, { status: 404 })
    }

    // 2. ⚠️ الخطوة الأهم: تأكد إن الطالب فعلاً مشترك ودافع لكورس الفيديو ده
    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('course_id', video.course_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!enrollment) {
      return NextResponse.json(
        { error: 'لازم تشترك في الكورس الأول عشان تشوف الفيديو ده' },
        { status: 403 }
      )
    }

    // 3. لو كله تمام، ابعتله رابط مشاهدة موقّع وصالح لساعتين بس
    const embedUrl = generateSecureEmbedUrl(video.bunny_video_id, 7200)

    return NextResponse.json({ embedUrl })
  } catch (err) {
    console.error('Playback URL error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
