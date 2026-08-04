import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { logActivity } from '@/lib/shared/activityLog'

async function loadOwnedQuiz(quizId: string, teacherId: string) {
  const { data: quiz } = await supabaseAdmin
    .from('quizzes')
    .select('id, title, is_published')
    .eq('id', quizId)
    .eq('teacher_id', teacherId)
    .single()
  return quiz
}

// PATCH /api/teacher/quizzes/[id] - تبديل حالة النشر
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireTeacher()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { teacherId } = auth

    const quiz = await loadOwnedQuiz(params.id, teacherId)
    if (!quiz) {
      return NextResponse.json({ error: 'الكويز مش موجود' }, { status: 404 })
    }

    // لو هنشره، لازم يكون فيه سؤال واحد على الأقل
    if (!quiz.is_published) {
      const { count } = await supabaseAdmin
        .from('quiz_questions')
        .select('id', { count: 'exact', head: true })
        .eq('quiz_id', quiz.id)

      if (!count) {
        return NextResponse.json({ error: 'ضيف سؤال واحد على الأقل قبل النشر' }, { status: 400 })
      }
    }

    const newStatus = !quiz.is_published
    await supabaseAdmin.from('quizzes').update({ is_published: newStatus }).eq('id', quiz.id)

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'quiz.publish',
      entityType: 'quiz',
      entityId: quiz.id,
      metadata: { isPublished: newStatus },
      request,
    })

    return NextResponse.json({ success: true, isPublished: newStatus })
  } catch (err) {
    console.error('Quiz publish toggle error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}

// DELETE /api/teacher/quizzes/[id]
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireTeacher()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { teacherId } = auth

    const quiz = await loadOwnedQuiz(params.id, teacherId)
    if (!quiz) {
      return NextResponse.json({ error: 'الكويز مش موجود' }, { status: 404 })
    }

    await supabaseAdmin.from('quizzes').delete().eq('id', quiz.id)

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'quiz.delete',
      entityType: 'quiz',
      entityId: quiz.id,
      metadata: { title: quiz.title },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Quiz delete error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
