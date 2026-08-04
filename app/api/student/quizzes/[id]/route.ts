import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireStudent } from '@/features/auth/lib/auth'

// GET /api/student/quizzes/[id]
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireStudent()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { studentId } = auth

    const { data: quiz } = await supabaseAdmin
      .from('quizzes')
      .select('id, title, description, course_id, time_limit_seconds, max_attempts, is_published')
      .eq('id', params.id)
      .eq('is_published', true)
      .single()

    if (!quiz) {
      return NextResponse.json({ error: 'الكويز مش موجود' }, { status: 404 })
    }

    // تأكد إن الطالب مشترك فعليًا في كورس الكويز ده
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
      .select('id, started_at, submitted_at, score, max_score')
      .eq('quiz_id', quiz.id)
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })

    const attemptsList = attempts || []
    const attemptsUsed = attemptsList.filter((a) => a.submitted_at).length
    const openAttempt = attemptsList.find((a) => !a.submitted_at) || null

    // لو الطالب مستنفد محاولاته ومفيش محاولة مفتوحة، منديلوش الأسئلة أصلاً
    if (attemptsUsed >= quiz.max_attempts && !openAttempt) {
      return NextResponse.json({
        quiz,
        questions: [],
        attemptsUsed,
        attemptsRemaining: 0,
        openAttempt: null,
        pastAttempts: attemptsList,
      })
    }

    const { data: questions } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, question_text, question_type, points, order_index, quiz_options(id, option_text, order_index)')
      .eq('quiz_id', quiz.id)
      .order('order_index', { ascending: true })

    // ⚠️ مهم: منرجعش is_correct للطالب خالص - بيتصحح على السيرفر بس وقت التسليم
    const safeQuestions = (questions || []).map((q) => ({
      ...q,
      quiz_options: (q.quiz_options || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((o: any) => ({ id: o.id, option_text: o.option_text })),
    }))

    return NextResponse.json({
      quiz,
      questions: safeQuestions,
      attemptsUsed,
      attemptsRemaining: Math.max(quiz.max_attempts - attemptsUsed, 0),
      openAttempt,
      pastAttempts: attemptsList,
    })
  } catch (err) {
    console.error('Student quiz fetch error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
