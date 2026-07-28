import { supabaseAdmin } from '@/lib/supabaseAdmin'

type ActivityAction =
  | 'login'
  | 'logout'
  | 'register'
  | 'password.reset'
  | 'course.create'
  | 'course.update'
  | 'course.delete'
  | 'video.upload'
  | 'video.delete'
  | 'enrollment.created'
  | 'payment.success'
  | 'payment.failure'
  | 'settings.update'
  | 'coupon.create'
  | 'coupon.usage'

interface LogActivityParams {
  userId: string | null
  userRole: 'teacher' | 'student' | 'system'
  action: ActivityAction
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  request?: Request // لو موجود، بنستخرج منه IP والمتصفح تلقائيًا
}

/**
 * بتسجل أي حدث مهم في جدول activity_logs.
 *
 * ⚠️ تصميم مقصود: الدالة دي "صامتة" لو فشلت (بتسجل الخطأ في الكونسول بس)
 * عشان فشل التسجيل مايوقفش العملية الأساسية للمستخدم (مثلاً: لو فشل تسجيل
 * "تم الدفع بنجاح" في اللوج، ميصحش إن ده يمنع تفعيل اشتراك الطالب فعليًا).
 * اللوج ثانوي بالنسبة للعملية نفسها، مش العكس.
 */
export async function logActivity({
  userId,
  userRole,
  action,
  entityType,
  entityId,
  metadata,
  request,
}: LogActivityParams): Promise<void> {
  try {
    const ip = request?.headers.get('x-forwarded-for') || null
    const userAgent = request?.headers.get('user-agent') || null

    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId,
      user_role: userRole,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      metadata: metadata || {},
      ip_address: ip,
      user_agent: userAgent,
    })
  } catch (err) {
    console.error('Activity log failed (non-blocking):', err)
  }
}
