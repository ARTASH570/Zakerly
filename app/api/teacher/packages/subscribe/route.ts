import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireTeacher } from '@/features/auth/lib/auth'
import { verifyRequestOrigin } from '@/lib/shared/csrf'
import { checkRateLimit } from '@/lib/shared/rateLimit'
import { subscribePackageSchema, validate } from '@/lib/shared/validation'
import { logActivity } from '@/lib/shared/activityLog'

// POST /api/teacher/packages/subscribe - اشتراك (أو تغيير) المعلم لباقة معينة
//
// ⚠️ ملحوظة مهمة: الراوت ده بيفعّل الباقة فورًا من غير بوابة دفع حقيقية -
// زي ما حصل مع الكورسات (Paymob/Stripe/PayPal في features/payments)، ده
// محتاج نفس التكامل لو عاوزين تحصيل فعلي من المعلم. حاليًا ده تفعيل مباشر
// يفيد كخطوة أولى (الأدمن يقدر يشوف مين مشترك في إيه ويحصّل يدوي لحد ما
// بوابة الدفع تتوصل)
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

    if (!(await checkRateLimit(`package-subscribe:${teacherId}`, 10, 3600))) {
      return NextResponse.json({ error: 'حاول تاني بعد شوية' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = validate(subscribePackageSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { packageId } = parsed.data

    const { data: pkg } = await supabaseAdmin
      .from('teacher_packages')
      .select('id, is_active')
      .eq('id', packageId)
      .maybeSingle()

    if (!pkg || !pkg.is_active) {
      return NextResponse.json({ error: 'الباقة دي مش متاحة حاليًا' }, { status: 404 })
    }

    // upsert على teacher_id (unique) - لو المعلم مشترك في باقة قبل كده، بنستبدلها
    const { data: subscription, error } = await supabaseAdmin
      .from('teacher_subscriptions')
      .upsert(
        {
          teacher_id: teacherId,
          package_id: packageId,
          status: 'active',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'teacher_id' }
      )
      .select()
      .single()

    if (error || !subscription) {
      return NextResponse.json({ error: 'حصل خطأ في تفعيل الاشتراك' }, { status: 500 })
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'package.subscribe',
      entityType: 'package',
      entityId: packageId,
      request,
    })

    return NextResponse.json({ subscription })
  } catch (err) {
    console.error('Package subscribe error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
