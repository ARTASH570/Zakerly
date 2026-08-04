import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { bulkCreateQuizQuestionsSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/teacher/quizzes/[id]/questions/bulk-create
// بيستخدمها المعلم بعد ما يراجع الأسئلة اللي اقترحها الـ AI ويختار اللي عايزها
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

    const { data: quiz } = await supabaseAdmin
      .from('quizzes')
      .select('id')
      .eq('id', params.id)
      .eq('teacher_id', teacherId)
      .single()

    if (!quiz) {
      return NextResponse.json({ error: 'الكويز مش موجود' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = validate(bulkCreateQuizQuestionsSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { count: existingCount } = await supabaseAdmin
      .from('quiz_questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', quiz.id)

    let savedCount = 0
    let startIndex = existingCount || 0

    for (const q of parsed.data.questions) {
      const { data: question, error } = await supabaseAdmin
        .from('quiz_questions')
        .insert({
          quiz_id: quiz.id,
          question_text: q.questionText,
          question_type: q.questionType,
          points: q.points || 1,
          order_index: startIndex,
        })
        .select()
        .single()

      if (error || !question) continue

      const { error: optionsError } = await supabaseAdmin.from('quiz_options').insert(
        q.options.map((o, i) => ({
          question_id: question.id,
          option_text: o.text,
          is_correct: o.isCorrect,
          order_index: i,
        }))
      )

      if (optionsError) {
        await supabaseAdmin.from('quiz_questions').delete().eq('id', question.id)
        continue
      }

      savedCount++
      startIndex++
    }

    if (savedCount > 0) {
      await supabaseAdmin.from('quizzes').update({ ai_generated: true }).eq('id', quiz.id)
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'quiz.question.create',
      entityType: 'quiz',
      entityId: quiz.id,
      metadata: { savedCount, source: 'ai_bulk' },
      request,
    })

    return NextResponse.json({ savedCount })
  } catch (err) {
    console.error('Quiz bulk question create error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
