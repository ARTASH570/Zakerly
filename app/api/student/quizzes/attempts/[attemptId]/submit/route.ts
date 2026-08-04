import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireStudent } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { submitQuizAttemptSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/student/quizzes/attempts/[attemptId]/submit
// التصحيح كله بيحصل هنا على السيرفر - الطالب أبدًا مابيبعتش درجته بنفسه
export async function POST(request: Request, { params }: { params: { attemptId: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireStudent()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { studentId } = auth

    const { data: attempt } = await supabaseAdmin
      .from('quiz_attempts')
      .select('id, quiz_id, student_id, submitted_at')
      .eq('id', params.attemptId)
      .eq('student_id', studentId)
      .single()

    if (!attempt) {
      return NextResponse.json({ error: 'المحاولة مش موجودة' }, { status: 404 })
    }
    if (attempt.submitted_at) {
      return NextResponse.json({ error: 'المحاولة دي اتسلمت قبل كده' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = validate(submitQuizAttemptSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { data: questions } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, points, quiz_options(id, is_correct)')
      .eq('quiz_id', attempt.quiz_id)

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'الكويز مفيهوش أسئلة' }, { status: 400 })
    }

    let totalScore = 0
    let maxScore = 0
    const answerRows: {
      attempt_id: string
      question_id: string
      selected_option_id: string | null
      is_correct: boolean
      points_earned: number
    }[] = []

    for (const question of questions) {
      maxScore += Number(question.points)
      const submitted = parsed.data.answers.find((a) => a.questionId === question.id)
      const options = (question.quiz_options || []) as { id: string; is_correct: boolean }[]
      const correctOption = options.find((o) => o.is_correct)

      const isCorrect = !!submitted?.selectedOptionId && submitted.selectedOptionId === correctOption?.id
      const pointsEarned = isCorrect ? Number(question.points) : 0
      totalScore += pointsEarned

      answerRows.push({
        attempt_id: attempt.id,
        question_id: question.id,
        selected_option_id: submitted?.selectedOptionId || null,
        is_correct: isCorrect,
        points_earned: pointsEarned,
      })
    }

    const { error: answersError } = await supabaseAdmin.from('quiz_answers').insert(answerRows)
    if (answersError) {
      return NextResponse.json({ error: 'حصل خطأ في حفظ الإجابات' }, { status: 500 })
    }

    await supabaseAdmin
      .from('quiz_attempts')
      .update({ submitted_at: new Date().toISOString(), score: totalScore, max_score: maxScore })
      .eq('id', attempt.id)

    // لكل سؤال، نرجع الإجابة الصح عشان الطالب يراجع أغلاطه
    const { data: fullOptions } = await supabaseAdmin
      .from('quiz_options')
      .select('id, question_id, option_text, is_correct')
      .in(
        'question_id',
        questions.map((q) => q.id)
      )

    const review = questions.map((q) => {
      const answerRow = answerRows.find((a) => a.question_id === q.id)
      return {
        questionId: q.id,
        isCorrect: answerRow?.is_correct || false,
        pointsEarned: answerRow?.points_earned || 0,
        selectedOptionId: answerRow?.selected_option_id || null,
        options: (fullOptions || []).filter((o) => o.question_id === q.id),
      }
    })

    await logActivity({
      userId: studentId,
      userRole: 'student',
      action: 'quiz.attempt.submit',
      entityType: 'quiz',
      entityId: attempt.quiz_id,
      metadata: { score: totalScore, maxScore },
      request,
    })

    return NextResponse.json({ score: totalScore, maxScore, review })
  } catch (err) {
    console.error('Quiz submit error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
