import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireStudent } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { verifyRequestOrigin } from '@/lib/csrf'
import { videoHeartbeatSchema, validate } from '@/lib/validation'

// POST /api/videos/heartbeat
// Body: { videoId: string, positionSeconds: number, durationSeconds?: number }
// ⚠️ بيتنادى كل كذا ثانية من المشغل أثناء التشغيل الفعلي (مش refresh عادي للصفحة)
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

    // نبضة كل 15 ثانية تقريبًا، فبنسمح بحد أعلى شوية عشان أي تفاوت في التوقيت
    if (!(await checkRateLimit(`video-heartbeat:${studentId}`, 20, 60))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(videoHeartbeatSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { videoId, positionSeconds, durationSeconds } = parsed.data

    // ⚠️ نفس التحقق اللي في route المشاهدة: الطالب ده فعلاً مشترك في كورس الفيديو ده؟
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('id, course_id, duration_seconds')
      .eq('id', videoId)
      .single()

    if (!video) {
      return NextResponse.json({ error: 'الفيديو مش موجود' }, { status: 404 })
    }

    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('course_id', video.course_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!enrollment) {
      return NextResponse.json({ error: 'مش مسموحلك' }, { status: 403 })
    }

    // لو مدة الفيديو عندنا لسه مش متسجلة، نسجلها أول مرة نستقبلها من المشغل
    const effectiveDuration = video.duration_seconds || durationSeconds || null
    if (!video.duration_seconds && durationSeconds) {
      await supabaseAdmin
        .from('videos')
        .update({ duration_seconds: Math.round(durationSeconds) })
        .eq('id', videoId)
    }

    // هاتلنا أبعد نقطة وصلها الطالب قبل كده، عشان منرجعوش لورا لو خبط مسافة في الفيديو
    const { data: existingView } = await supabaseAdmin
      .from('video_views')
      .select('max_position_seconds')
      .eq('student_id', studentId)
      .eq('video_id', videoId)
      .maybeSingle()

    const newMaxPosition = Math.max(existingView?.max_position_seconds || 0, positionSeconds)
    const completed = effectiveDuration ? newMaxPosition >= effectiveDuration * 0.9 : false

    await supabaseAdmin.from('video_views').upsert(
      {
        student_id: studentId,
        video_id: videoId,
        course_id: video.course_id,
        max_position_seconds: newMaxPosition,
        duration_seconds: effectiveDuration,
        completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,video_id' }
    )

    return NextResponse.json({ success: true, completed })
  } catch (err) {
    console.error('Video heartbeat error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
