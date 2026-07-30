import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { requireStudent, requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { fetchMessages, sendMessage } from '@/features/chat/lib/chat'

async function resolveCurrentUser() {
  const teacherAuth = await requireTeacher()
  if (!('error' in teacherAuth)) {
    return { userId: teacherAuth.teacherId, role: 'teacher' as const }
  }
  const studentAuth = await requireStudent()
  if (!('error' in studentAuth)) {
    return { userId: studentAuth.studentId, role: 'student' as const }
  }
  return null
}

// GET /api/chat/conversations/[id]/messages
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await resolveCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لازم تسجل دخولك الأول' }, { status: 401 })
    }

    const result = await fetchMessages(params.id, user.userId)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('Fetch messages error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}

// POST /api/chat/conversations/[id]/messages
// Body: { body: string }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const user = await resolveCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لازم تسجل دخولك الأول' }, { status: 401 })
    }

    // حد معقول للرسائل عشان نمنع الإسبام
    if (!(await checkRateLimit(`chat-message-send:${user.userId}`, 60, 60))) {
      return NextResponse.json({ error: 'بتبعت رسايل كتير بسرعة، هدّي شوية' }, { status: 429 })
    }

    const requestBody = await request.json()
    const result = await sendMessage(params.id, user.userId, user.role, requestBody.body ?? '')
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('Send message error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
