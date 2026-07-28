'use client'

import { useState } from 'react'

interface PaymentButtonProps {
  courseId: string
  price: number
  isEgyptOrMena: boolean // بتحددها حسب دولة الطالب (ممكن من بياناته أو من IP)
}

export default function PaymentButton({ courseId, price, isEgyptOrMena }: PaymentButtonProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [showCouponField, setShowCouponField] = useState(false)

  async function handlePay(provider: 'paymob' | 'stripe' | 'paypal') {
    setLoading(provider)
    setErrorMsg('')

    const endpoints: Record<typeof provider, string> = {
      paymob: '/api/payments/paymob/create',
      stripe: '/api/payments/stripe/create',
      paypal: '/api/payments/paypal/create',
    }

    try {
      const res = await fetch(endpoints[provider], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          couponCode: couponCode.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'حصل خطأ، حاول تاني')
        return
      }

      window.location.href = data.checkoutUrl
    } catch {
      setErrorMsg('حصل خطأ في الاتصال، حاول تاني')
    } finally {
      setLoading(null)
    }
  }

  const couponField = (
    <div className="mb-3">
      {showCouponField ? (
        <input
          type="text"
          placeholder="عندك كود خصم؟"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          className="w-full bg-board border border-line rounded-lg px-4 py-2 text-chalk placeholder:text-chalk/40 text-sm focus:outline-none focus:border-gold"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowCouponField(true)}
          className="text-gold text-xs underline"
        >
          عندك كود خصم؟
        </button>
      )}
    </div>
  )

  // مصر/الخليج: باي موب بس، هو الأنسب للمنطقة دي
  if (isEgyptOrMena) {
    return (
      <div>
        {couponField}
        <button
          onClick={() => handlePay('paymob')}
          disabled={loading !== null}
          className="bg-gold text-board font-bold rounded-lg px-6 py-3 hover:bg-gold/90 transition-colors disabled:opacity-50 w-full"
        >
          {loading === 'paymob' ? 'جاري التحويل...' : `ادفع ${price} جنيه`}
        </button>
        {errorMsg && <p className="text-red-400 text-sm mt-2">{errorMsg}</p>}
      </div>
    )
  }

  // دولي: نديله خيارين، يختار الأنسب ليه
  return (
    <div>
      {couponField}
      <div className="space-y-3">
        <button
          onClick={() => handlePay('paypal')}
          disabled={loading !== null}
          className="bg-[#FFC439] text-[#003087] font-bold rounded-lg px-6 py-3 hover:opacity-90 transition-opacity disabled:opacity-50 w-full"
        >
          {loading === 'paypal' ? 'جاري التحويل...' : `PayPal — ${price} دولار`}
        </button>
        <button
          onClick={() => handlePay('stripe')}
          disabled={loading !== null}
          className="bg-gold text-board font-bold rounded-lg px-6 py-3 hover:bg-gold/90 transition-colors disabled:opacity-50 w-full"
        >
          {loading === 'stripe' ? 'جاري التحويل...' : `ادفع بالبطاقة — ${price} دولار`}
        </button>
        {errorMsg && <p className="text-red-400 text-sm mt-2">{errorMsg}</p>}
      </div>
    </div>
  )
}
