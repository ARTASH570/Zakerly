import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { createQuizQuestionSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/teacher/quizzes/[id]/questions/create
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
    const parsed = validate(createQuizQuestionSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { questionText, questionType, points, options } = parsed.data

    const { count } = await supabaseAdmin
      .from('quiz_questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', quiz.id)

    const { data: question, error } = await supabaseAdmin
      .from('quiz_questions')
      .insert({
        quiz_id: quiz.id,
        question_text: questionText,
        question_type: questionType,
        points: points || 1,
        order_index: count || 0,
      })
      .select()
      .single()

    if (error || !question) {
      return NextResponse.json({ error: 'حصل خطأ في إضافة السؤال' }, { status: 500 })
    }

    const { error: optionsError } = await supabaseAdmin.from('quiz_options').insert(
      options.map((o, i) => ({
        question_id: question.id,
        option_text: o.text,
        is_correct: o.isCorrect,
        order_index: i,
      }))
    )

    if (optionsError) {
      // نظّف السؤال لو الاختيارات فشلت، عشان مانسيبش سؤال يتيم من غير اختيارات
      await supabaseAdmin.from('quiz_questions').delete().eq('id', question.id)
      return NextResponse.json({ error: 'حصل خطأ في إضافة الاختيارات' }, { status: 500 })
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'quiz.question.create',
      entityType: 'quiz_question',
      entityId: question.id,
      metadata: { quizId: quiz.id },
      request,
    })

    return NextResponse.json({ question })
  } catch (err) {
    console.error('Quiz question create error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
