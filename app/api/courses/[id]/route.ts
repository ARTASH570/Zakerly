// المسار المفروض: app/api/courses/[id]/route.ts
//
// ⚠️ لو الـ import بتاع createClient تحت مختلف عندك، غيّره بس -
// المفروض عندك ملف بيعمل server client بيقرأ الكوكيز (نفس الي بيستخدمه أي route محمي عندك حاليًا)
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const courseId = params.id
  const supabase = createServerSupabaseClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'غير مسجل دخول' }, { status: 401 })
  }
  const teacherId = userData.user.id

  // نتأكد إن الكورس ده بتاع المعلم ده فعلاً (RLS كمان بتضمن الحماية دي، بس بنتأكد يدويًا عشان الرسالة تبقى واضحة)
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, title, teacher_id')
    .eq('id', courseId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (courseError || !course) {
    return NextResponse.json({ error: 'الكورس مش موجود أو مش بتاعك' }, { status: 404 })
  }

  // بنعد الاشتراكات الفعالة والمدفوعات الناجحة على الكورس ده
  const { count: enrolledCount } = await supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq('is_active', true)

  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('course_id', courseId)
    .eq('status', 'success')

  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
  const hasStudents = (enrolledCount || 0) > 0 || (payments || []).length > 0

  // مفيش طلاب مشتركين خالص → مسح مباشر
  if (!hasStudents) {
    const { error: deleteError } = await supabase.from('courses').delete().eq('id', courseId)
    if (deleteError) {
      return NextResponse.json({ error: 'حصل خطأ أثناء الحذف' }, { status: 500 })
    }
    return NextResponse.json({ action: 'deleted' })
  }

  // فيه طلاب مشتركين → نسجل طلب حذف بدل الحذف المباشر
  let body: { reason?: string } = {}
  try {
    body = await req.json()
  } catch {
    // مفيش body، مش مشكلة - reason هتبقى فاضية
  }

  const { error: insertError } = await supabase.from('deletion_requests').insert({
    course_id: courseId,
    teacher_id: teacherId,
    course_title: course.title,
    reason: body.reason || null,
    enrolled_count: enrolledCount || 0,
    total_paid: totalPaid,
  })

  if (insertError) {
    // لو فيه طلب pending موجود بالفعل، الـ unique index هيرفض الإدراج
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'فيه طلب حذف قيد المراجعة بالفعل لنفس الكورس' }, { status: 409 })
    }
    return NextResponse.json({ error: 'حصل خطأ أثناء تسجيل الطلب' }, { status: 500 })
  }

  return NextResponse.json({ action: 'requested' })
}
