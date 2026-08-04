import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'

// بيانات الباقات المفعّلة عامة ومشتركة بين كل المعلمين ومابتتغيرش كتير
// (الأدمن بس بيعدلها من وقت للتاني)، فمفيش داعي نضرب الداتابيز بيها في كل
// طلب - بنكاشها 5 دقايق، وبنفضّيها فورًا لو الأدمن عدّل باقة (revalidateTag
// في app/api/admin/packages/[id]/route.ts)
const getCachedActivePackages = unstable_cache(
  async () => {
    const { data } = await supabaseAdmin
      .from('teacher_packages')
      .select(
        'id, name, description, price, max_courses, max_students, live_sessions, coupons_enabled, priority_support'
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    return data || []
  },
  ['teacher-packages-active'],
  { tags: ['packages'], revalidate: 300 }
)

// GET /api/teacher/packages - الباقات المتاحة للاشتراك + الباقة الحالية للمعلم
export async function GET() {
  try {
    const auth = await requireTeacher()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { teacherId } = auth

    // ⚠️ الاشتراك الحالي للمعلم بيانات خاصة بيه ومتغيّرة - ده بيتقرا فريش من
    // الداتابيز كل مرة، من غير كاش، عكس قايمة الباقات العامة فوق
    const [packages, subscription] = await Promise.all([
      getCachedActivePackages(),
      supabaseAdmin
        .from('teacher_subscriptions')
        .select('package_id, status, started_at')
        .eq('teacher_id', teacherId)
        .eq('status', 'active')
        .maybeSingle()
        .then((r) => r.data),
    ])

    return NextResponse.json(
      {
        packages,
        currentPackageId: subscription?.package_id || null,
        subscribedAt: subscription?.started_at || null,
      },
      // الكاش على مستوى المتصفح/الـ CDN: خاص بالمتصفح لوحده (private) لأن
      // الرد فيه currentPackageId بتاع المعلم ده بالذات
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    )
  } catch (err) {
    console.error('Teacher packages list error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
