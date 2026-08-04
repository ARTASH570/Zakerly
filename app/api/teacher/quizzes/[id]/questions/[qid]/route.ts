import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'

// DELETE /api/teacher/quizzes/[id]/questions/[qid]
export async function DELETE(request: Request, { params }: { params: { id: string; qid: string } }) {
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

    await supabaseAdmin.from('quiz_questions').delete().eq('id', params.qid).eq('quiz_id', quiz.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Quiz question delete error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
