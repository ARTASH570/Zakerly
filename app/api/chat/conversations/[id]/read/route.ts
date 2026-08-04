import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { requireStudent, requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { markMessagesRead } from '@/features/chat/lib/chat'

// POST /api/chat/conversations/[id]/read
// بيعلّم كل رسايل الطرف التاني في المحادثة دي كمقروءة
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const teacherAuth = await requireTeacher()
    if (!('error' in teacherAuth)) {
      await markMessagesRead(params.id, teacherAuth.teacherId)
      return NextResponse.json({ success: true })
    }

    const studentAuth = await requireStudent()
    if (!('error' in studentAuth)) {
      await markMessagesRead(params.id, studentAuth.studentId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'لازم تسجل دخولك الأول' }, { status: 401 })
  } catch (err) {
    console.error('Mark read error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
