import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { requireStudent, requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { listConversations, getOrCreateConversation } from '@/features/chat/lib/chat'

// GET /api/chat/conversations
// بيرجع كل محادثات المستخدم الحالي (معلم كان أو طالب)
export async function GET() {
  try {
    const teacherAuth = await requireTeacher()
    if (!('error' in teacherAuth)) {
      const result = await listConversations(teacherAuth.teacherId, 'teacher')
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json(result)
    }

    const studentAuth = await requireStudent()
    if (!('error' in studentAuth)) {
      const result = await listConversations(studentAuth.studentId, 'student')
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'لازم تسجل دخولك الأول' }, { status: 401 })
  } catch (err) {
    console.error('List conversations error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}

// POST /api/chat/conversations
// Body: { teacherId, courseId? } لو الطالب هو اللي بادئ المحادثة
// Body: { studentId, courseId? } لو المعلم هو اللي بادئ المحادثة
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const body = await request.json()

    const teacherAuth = await requireTeacher()
    if (!('error' in teacherAuth)) {
      if (!(await checkRateLimit(`chat-conversation-create:${teacherAuth.teacherId}`, 30, 3600))) {
        return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
      }
      if (!body.studentId || typeof body.studentId !== 'string') {
        return NextResponse.json({ error: 'لازم تحدد الطالب' }, { status: 400 })
      }
      const result = await getOrCreateConversation(teacherAuth.teacherId, body.studentId, body.courseId)
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json(result)
    }

    const studentAuth = await requireStudent()
    if (!('error' in studentAuth)) {
      if (!(await checkRateLimit(`chat-conversation-create:${studentAuth.studentId}`, 30, 3600))) {
        return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
      }
      if (!body.teacherId || typeof body.teacherId !== 'string') {
        return NextResponse.json({ error: 'لازم تحدد المعلم' }, { status: 400 })
      }
      const result = await getOrCreateConversation(body.teacherId, studentAuth.studentId, body.courseId)
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'لازم تسجل دخولك الأول' }, { status: 401 })
  } catch (err) {
    console.error('Create conversation error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
