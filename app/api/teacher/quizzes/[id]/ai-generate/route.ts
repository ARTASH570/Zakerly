import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { aiGenerateQuestionsSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'
import { generateQuizQuestions } from '@/features/quizzes/lib/anthropic'

// POST /api/teacher/quizzes/[id]/ai-generate
// بيرجع أسئلة مقترحة بس، من غير ما يحفظها - المعلم يراجعها ويحفظ اللي عايزه
// عن طريق /questions/bulk-create
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

    // مهم: rate limit صارم هنا لأن كل طلب بيكلف فلوس فعلية (استدعاء AI)
    if (!(await checkRateLimit(`quiz-ai-generate:${teacherId}`, 15, 3600))) {
      return NextResponse.json({ error: 'وصلت للحد الأقصى من التوليد بالـ AI الساعة دي، حاول تاني بعدين' }, { status: 429 })
    }

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
    const parsed = validate(aiGenerateQuestionsSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    let questions
    try {
      questions = await generateQuizQuestions(parsed.data.lessonContent, parsed.data.count)
    } catch (err) {
      console.error('AI question generation failed:', err)
      const message = err instanceof Error ? err.message : 'حصل خطأ في التوليد'
      return NextResponse.json({ error: message }, { status: 502 })
    }

    if (questions.length === 0) {
      return NextResponse.json({ error: 'مقدرتش أطلع أسئلة من المحتوى ده، جرب تفاصيل أكتر' }, { status: 422 })
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'quiz.ai_generate',
      entityType: 'quiz',
      entityId: quiz.id,
      metadata: { requestedCount: parsed.data.count, returnedCount: questions.length },
      request,
    })

    return NextResponse.json({ questions })
  } catch (err) {
    console.error('Quiz AI generate error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
