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
    const { packageId, referenceNumber, note } = parsed.data

    const { data: pkg } = await supabaseAdmin
      .from('teacher_packages')
      .select('id, is_active, price')
      .eq('id', packageId)
      .maybeSingle()

    if (!pkg || !pkg.is_active) {
      return NextResponse.json({ error: 'الباقة دي مش متاحة حاليًا' }, { status: 404 })
    }

    // بدل التفعيل الفوري: بنسجل طلب الدفع "قيد الانتظار" لحد ما الأدمن
    // يراجعه يدوي (المعلم بيبعت رقم مرجع تحويل Instapay/Vodafone Cash)
    const { data: paymentRequest, error } = await supabaseAdmin
      .from('package_payment_requests')
      .insert({
        teacher_id: teacherId,
        package_id: packageId,
        amount: pkg.price,
        reference_number: referenceNumber,
        note: note || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error || !paymentRequest) {
      return NextResponse.json({ error: 'حصل خطأ في إرسال الطلب' }, { status: 500 })
    }

    await logActivity({
      userId: teacherId,
      userRole: 'teacher',
      action: 'package.payment_request',
      entityType: 'package',
      entityId: packageId,
      request,
    })

    return NextResponse.json({
      paymentRequest,
      message: 'طلبك اتبعت، هيتم مراجعته خلال 24 ساعة',
    })
  } catch (err) {
    console.error('Package subscribe error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
