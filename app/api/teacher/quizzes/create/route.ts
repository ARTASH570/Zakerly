import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { createQuizSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/teacher/quizzes/create
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

    if (!(await checkRateLimit(`quiz-create:${teacherId}`, 30, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(createQuizSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { courseId, videoId, title, description, timeLimitSeconds, maxAttempts } = parsed.data

    // تأكد إن الكورس ده بتاع المعلم فعلاً
    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('teacher_id', teacherId)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'الكورس ده مش بتاعك' }, { status: 403 })
    }

    // لو مرتبط بفيديو، تأكد إن الفيديو ده تابع لنفس الكورس
    if (videoId) {
      const { data: video } = await supabaseAdmin
        .from('videos')
        .select('id')
        .eq('id', videoId)
        .eq('course_id', courseId)
        .single()

      if (!video) {
        return NextResponse.json({ error: 'الفيديو ده مش تابع للكورس ده' }, { status: 400 })
      }
    }

    const { data: quiz, error } = await supabaseAdmin
      .from('quizzes')
      .insert({
        teacher_id: teacherId,
        course_id: courseId,
        video_id: videoId || null,
        title,
        description: description || null,
        time_limit_seconds: timeLimitSeconds || null,
        max_attempts: maxAttempts || 1,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'حصل خطأ في إنشاء الكويز' }, { status: 500 })
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'quiz.create',
      entityType: 'quiz',
      entityId: quiz.id,
      metadata: { title },
      request,
    })

    return NextResponse.json({ quiz })
  } catch (err) {
    console.error('Quiz create error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
