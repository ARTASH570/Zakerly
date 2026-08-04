import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { updatePackageSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'

// PATCH /api/admin/packages/[id] - تعديل السعر/الوصف/الصلاحيات لباقة موجودة
// ⚠️ تعمّدنا عدم عمل POST (إنشاء) أو DELETE هنا: المنصة عندها 3 باقات ثابتة
// اتزرعت من ملف الـ schema، والأدمن بيعدّل فيها بس (مش بيضيف/يشيل باقات)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json({ error: 'طلب مرفوض' }, { status: 403 })
    }

    const auth = await requireAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { adminId } = auth

    if (!(await checkRateLimit(`package-update:${adminId}`, 30, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(updatePackageSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('teacher_packages')
      .select('id')
      .eq('id', params.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'الباقة مش موجودة' }, { status: 404 })
    }

    // بنبني كائن التحديث بس من الحقول اللي فعلًا اتبعتت - عشان لو الأدمن بعت
    // سعر بس من غير وصف، الوصف الحالي يفضل زي ما هو مش يتصفّر بالغلط
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const d = parsed.data
    if (d.name !== undefined) updates.name = d.name
    if (d.description !== undefined) updates.description = d.description
    if (d.price !== undefined) updates.price = d.price
    if (d.maxCourses !== undefined) updates.max_courses = d.maxCourses
    if (d.maxStudents !== undefined) updates.max_students = d.maxStudents
    if (d.liveSessions !== undefined) updates.live_sessions = d.liveSessions
    if (d.couponsEnabled !== undefined) updates.coupons_enabled = d.couponsEnabled
    if (d.prioritySupport !== undefined) updates.priority_support = d.prioritySupport
    if (d.isActive !== undefined) updates.is_active = d.isActive

    const { data: updated, error } = await supabaseAdmin
      .from('teacher_packages')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error || !updated) {
      return NextResponse.json({ error: 'حصل خطأ في تحديث الباقة' }, { status: 500 })
    }

    await logActivity({
      userId: adminId,
      userRole: 'admin',
      action: 'package.update',
      entityType: 'package',
      entityId: params.id,
      metadata: updates,
      request,
    })

    // بدون ده، تعديل الأدمن مش هيبان للمعلمين إلا بعد ما الكاش (5 دقايق) ينتهي لوحده
    revalidateTag('packages')

    return NextResponse.json({ package: updated })
  } catch (err) {
    console.error('Admin package update error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
