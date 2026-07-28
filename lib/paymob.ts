// دوال مساعدة للتعامل مع Paymob (Intention API - الطريقة الحديثة)
// التوثيق: https://developers.paymob.com/paymob-docs/integration-paths/apis

const PAYMOB_BASE_URL = 'https://accept.paymob.com'

interface CreateIntentionParams {
  amountCents: number // المبلغ بالقروش (100 قرش = 1 جنيه)
  merchantOrderId: string // معرف فريد من عندنا (مثلاً payment.id بتاعنا)
  customerName: string
  customerEmail: string
  customerPhone: string
}

/**
 * بينشئ "نية دفع" (Intention) على Paymob ويرجع client_secret
 * اللي بنستخدمه بعدين عشان نوجّه الطالب لصفحة الدفع
 */
export async function createPaymobIntention({
  amountCents,
  merchantOrderId,
  customerName,
  customerEmail,
  customerPhone,
}: CreateIntentionParams) {
  const response = await fetch(`${PAYMOB_BASE_URL}/v1/intention/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`,
    },
    body: JSON.stringify({
      amount: amountCents,
      currency: 'EGP',
      payment_methods: [Number(process.env.PAYMOB_INTEGRATION_ID)],
      merchant_order_id: merchantOrderId,
      items: [],
      billing_data: {
        first_name: customerName.split(' ')[0] || customerName,
        last_name: customerName.split(' ').slice(1).join(' ') || 'طالب',
        email: customerEmail,
        phone_number: customerPhone || '+201000000000',
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Paymob intention failed: ${errText}`)
  }

  const data = await response.json()
  return {
    clientSecret: data.client_secret as string,
    intentionId: data.id as string,
  }
}

/**
 * بيرجع رابط صفحة الدفع الموحدة (Unified Checkout) اللي هنوجّه الطالب ليها
 */
export function getPaymobCheckoutUrl(clientSecret: string) {
  const publicKey = process.env.NEXT_PUBLIC_PAYMOB_PUBLIC_KEY
  return `${PAYMOB_BASE_URL}/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${clientSecret}`
}
