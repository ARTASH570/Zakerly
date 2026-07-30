import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

/**
 * بترد فلوس دفعة Stripe فعليًا - بتاخد الـ Checkout Session ID اللي محفوظ
 * عندنا كـ provider_transaction_id، وتجيب منه الـ payment_intent الحقيقي
 * (Stripe الاسترداد بيحتاج payment_intent أو charge id، مش رقم الجلسة نفسه)
 */
export async function refundStripePayment(checkoutSessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId)

  if (!session.payment_intent) {
    throw new Error('مفيش payment_intent مرتبط بالجلسة دي - ممكن الدفع ماكملش فعليًا')
  }

  const refund = await stripe.refunds.create({
    payment_intent: session.payment_intent as string,
  })

  return refund
}
