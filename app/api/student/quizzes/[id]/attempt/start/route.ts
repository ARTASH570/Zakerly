import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireStudent } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/student/quizzes/[id]/attempt/start
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireStudent()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { studentId } = auth

    if (!(await checkRateLimit(`quiz-attempt-start:${studentId}`, 30, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const { data: quiz } = await supabaseAdmin
      .from('quizzes')
      .select('id, course_id, max_attempts')
      .eq('id', params.id)
      .eq('is_published', true)
      .single()

    if (!quiz) {
      return NextResponse.json({ error: 'الكويز مش موجود' }, { status: 404 })
    }

    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('course_id', quiz.course_id)
      .eq('student_id', studentId)
      .eq('is_active', true)
      .single()

    if (!enrollment) {
      return NextResponse.json({ error: 'لازم تكون مشترك في الكورس ده الأول' }, { status: 403 })
    }

    const { data: attempts } = await supabaseAdmin
      .from('quiz_attempts')
      .select('id, submitted_at')
      .eq('quiz_id', quiz.id)
      .eq('student_id', studentId)

    const attemptsList = attempts || []
    const openAttempt = attemptsList.find((a) => !a.submitted_at)
    if (openAttempt) {
      return NextResponse.json({ attemptId: openAttempt.id })
    }

    const attemptsUsed = attemptsList.filter((a) => a.submitted_at).length
    if (attemptsUsed >= quiz.max_attempts) {
      return NextResponse.json({ error: 'استنفدت عدد المحاولات المسموح بيها' }, { status: 403 })
    }

    const { data: questionsCount } = await supabaseAdmin
      .from('quiz_questions')
      .select('points')
      .eq('quiz_id', quiz.id)

    const maxScore = (questionsCount || []).reduce((sum, q) => sum + Number(q.points), 0)

    const { data: attempt, error } = await supabaseAdmin
      .from('quiz_attempts')
      .insert({ quiz_id: quiz.id, student_id: studentId, max_score: maxScore })
      .select()
      .single()

    if (error || !attempt) {
      return NextResponse.json({ error: 'حصل خطأ في بدء المحاولة' }, { status: 500 })
    }

    await logActivity({
      userId: studentId,
      userRole: 'student',
      action: 'quiz.attempt.start',
      entityType: 'quiz',
      entityId: quiz.id,
      request,
    })

    return NextResponse.json({ attemptId: attempt.id })
  } catch (err) {
    console.error('Quiz attempt start error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
