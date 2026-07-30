// دوال مساعدة للتعامل مع PayPal (Orders API v2)
// التوثيق: https://developer.paypal.com/docs/api/orders/v2/

const PAYPAL_BASE_URL =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

/**
 * بنجيب توكن دخول مؤقت من PayPal عشان نقدر نكلم الـ API بتاعهم
 */
async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`فشل الحصول على توكن PayPal: ${await response.text()}`)
  }

  const data = await response.json()
  return data.access_token as string
}

/**
 * بننشئ "طلب دفع" (Order) على PayPal وبنربطه برقم الدفعة عندنا (custom_id)
 * عشان لما ندور عليه بعدين نلاقيه بسهولة
 */
export async function createPaypalOrder(amountUsd: number, paymentId: string) {
  const accessToken = await getAccessToken()

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: paymentId,
          amount: {
            currency_code: 'USD',
            value: amountUsd.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/student/paypal/return`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/student/dashboard?payment=cancelled`,
        user_action: 'PAY_NOW',
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`فشل إنشاء طلب PayPal: ${await response.text()}`)
  }

  const data = await response.json()
  const approveLink = data.links.find((link: any) => link.rel === 'approve')?.href

  return { orderId: data.id as string, approveUrl: approveLink as string }
}

/**
 * بعد ما الطالب يوافق على الدفع في صفحة PayPal، بنأكد العملية فعليًا هنا
 * (لحد ما نعمل "capture"، الفلوس لسه ما اتحولتش فعليًا)
 */
export async function capturePaypalOrder(orderId: string) {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`فشل تأكيد دفعة PayPal: ${JSON.stringify(data)}`)
  }

  const purchaseUnit = data.purchase_units?.[0]
  const capture = purchaseUnit?.payments?.captures?.[0]

  return {
    success: capture?.status === 'COMPLETED',
    paymentId: purchaseUnit?.custom_id as string, // ده رقم الدفعة عندنا اللي بعتناه وقت الإنشاء
    captureId: capture?.id as string,
  }
}

/**
 * بيتحقق إن الـ webhook اللي جالنا فعلاً جاي من PayPal نفسه، مش حد بيحاول
 * يزوّر إشعار "تم الدفع بنجاح" عشان ياخد اشتراك من غير ما يدفع فعليًا
 */
export async function verifyPaypalWebhookSignature(headers: Headers, rawBody: string) {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transmission_id: headers.get('paypal-transmission-id'),
        transmission_time: headers.get('paypal-transmission-time'),
        cert_url: headers.get('paypal-cert-url'),
        auth_algo: headers.get('paypal-auth-algo'),
        transmission_sig: headers.get('paypal-transmission-sig'),
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(rawBody),
      }),
    }
  )

  const data = await response.json()
  return data.verification_status === 'SUCCESS'
}

/**
 * بترد فلوس دفعة PayPal فعليًا - بتاخد الـ Capture ID المحفوظ عندنا
 * كـ provider_transaction_id مباشرة (PayPal الاسترداد بيحتاج الـ capture id بالظبط)
 */
export async function refundPaypalPayment(captureId: string) {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v2/payments/captures/${captureId}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`فشل استرداد دفعة PayPal: ${JSON.stringify(data)}`)
  }

  return data
}
