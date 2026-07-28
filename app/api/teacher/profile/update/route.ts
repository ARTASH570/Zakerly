import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireTeacher } from '@/lib/auth'
import { verifyRequestOrigin } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rateLimit'
import { z } from 'zod'
import { validate } from '@/lib/validation'
import { logActivity } from '@/lib/activityLog'

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  subject: z.string().trim().max(150).optional(),
  bio: z.string().trim().max(2000).optional(),
  phone: z.string().trim().max(20).optional(),
})

// POST /api/teacher/profile/update
export async function POST(request: Request) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireTeacher()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { teacherId } = auth

    if (!(await checkRateLimit(`profile-update:${teacherId}`, 10, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(updateProfileSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { fullName, subject, bio, phone } = parsed.data

    const { error } = await supabaseAdmin
      .from('teachers')
      .update({ full_name: fullName, subject, bio, phone })
      .eq('id', teacherId)

    if (error) {
      return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'settings.update',
      entityType: 'teacher_profile',
      entityId: teacherId,
      request,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Profile update error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
