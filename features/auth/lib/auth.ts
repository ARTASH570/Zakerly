import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * بيتحقق من التوكن الحقيقي بتاع المستخدم (من الكوكيز)، مش من أي ID
 * بيتبعت في جسم الطلب. لو التوكن مش موجود أو منتهي، بيرجع null.
 */
async function getVerifiedUser() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
}

/**
 * تستخدمها في أول أي API route المفروض طالب بس يقدر يستخدمه.
 * بترجع studentId فعلي ومتحقق منه، أو رسالة خطأ جاهزة تترجع للمستخدم.
 */
export async function requireStudent(): Promise<
  { studentId: string } | { error: string; status: number }
> {
  const user = await getVerifiedUser()
  if (!user) {
    return { error: 'لازم تسجل دخولك الأول', status: 401 }
  }

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, is_disabled')
    .eq('id', user.id)
    .maybeSingle()

  if (!student) {
    return { error: 'الإجراء ده متاح للطلاب بس', status: 403 }
  }

  if (student.is_disabled) {
    return { error: 'حسابك متوقف حاليًا، تواصل مع الدعم', status: 403 }
  }

  return { studentId: user.id }
}

/**
 * نفس الفكرة بس للمعلم
 */
export async function requireTeacher(): Promise<
  { teacherId: string } | { error: string; status: number }
> {
  const user = await getVerifiedUser()
  if (!user) {
    return { error: 'لازم تسجل دخولك الأول', status: 401 }
  }

  const { data: teacher } = await supabaseAdmin
    .from('teachers')
    .select('id, is_disabled')
    .eq('id', user.id)
    .maybeSingle()

  if (!teacher) {
    return { error: 'الإجراء ده متاح للمعلمين بس', status: 403 }
  }

  if (teacher.is_disabled) {
    return { error: 'حسابك متوقف حاليًا، تواصل مع الدعم', status: 403 }
  }

  return { teacherId: user.id }
}

/**
 * تستخدمها في أول أي API route خاص بلوحة تحكم الأدمن.
 * ⚠️ حسابات الأدمن ماليهاش تسجيل ذاتي خالص (مفيش صفحة "اعمل حساب أدمن") -
 * بتتعمل يدوي بس عن طريق إدراج مباشر في قاعدة البيانات، وده مقصود أمنيًا.
 */
export async function requireAdmin(): Promise<
  { adminId: string } | { error: string; status: number }
> {
  const user = await getVerifiedUser()
  if (!user) {
    return { error: 'لازم تسجل دخولك الأول', status: 401 }
  }

  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!admin) {
    return { error: 'الإجراء ده متاح للأدمن بس', status: 403 }
  }

  return { adminId: user.id }
}
