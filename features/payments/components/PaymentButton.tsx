'use client'

import { useState, useEffect } from 'react'

interface PaymentButtonProps {
  courseId: string
  price: number
  isEgyptOrMena: boolean
}

export default function PaymentButton({ courseId, price, isEgyptOrMena }: PaymentButtonProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [showCouponField, setShowCouponField] = useState(false)

  const [couponStatus, setCouponStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>(
    'idle'
  )
  const [couponError, setCouponError] = useState('')
  const [discountedPriceEgp, setDiscountedPriceEgp] = useState<number | null>(null)
  const [discountedPriceUsd, setDiscountedPriceUsd] = useState<number | null>(null)

  const [usdPrice, setUsdPrice] = useState<number | null>(null)

  useEffect(() => {
    if (isEgyptOrMena) return

    let cancelled = false

    async function loadUsdPrice() {
      try {
        const res = await fetch(`/api/payments/exchange-rate?amount=${price}`)
        const data = await res.json()
        if (!cancelled && res.ok) {
          setUsdPrice(data.usd)
        }
      } catch {
        // هنسيب usdPrice null
      }
    }

    loadUsdPrice()
    return () => {
      cancelled = true
    }
  }, [price, isEgyptOrMena])

  useEffect(() => {
    if (!couponCode.trim()) {
      setCouponStatus('idle')
      setDiscountedPriceEgp(null)
      setDiscountedPriceUsd(null)
      setCouponError('')
      return
    }

    setCouponStatus('checking')
    let cancelled = false

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/payments/coupons/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, couponCode: couponCode.trim() }),
        })
        const data = await res.json()

        if (cancelled) return

        if (!res.ok || !data.valid) {
          setCouponStatus('invalid')
          setCouponError(data.error || 'كود الخصم غير صحيح')
          setDiscountedPriceEgp(null)
          setDiscountedPriceUsd(null)
          return
        }

        setCouponStatus('valid')
        setCouponError('')
        setDiscountedPriceEgp(data.finalPrice)
        setDiscountedPriceUsd(data.finalPriceUsd)
      } catch {
        if (!cancelled) {
          setCouponStatus('invalid')
          setCouponError('حصل خطأ في التحقق من الكود')
        }
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [couponCode, courseId])

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
          couponCode: couponStatus === 'valid' ? couponCode.trim() : undefined,
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
        <div>
          <input
            type="text"
            placeholder="عندك كود خصم؟"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="w-full bg-board border border-line rounded-lg px-4 py-2 text-chalk placeholder:text-chalk/40 text-sm focus:outline-none focus:border-gold"
          />
          {couponStatus === 'checking' && (<p className="text-chalk/40 text-xs mt-1">جاري التحقق من الكود...</p>
          )}
          {couponStatus === 'invalid' && (
            <p className="text-red-400 text-xs mt-1">{couponError}</p>
          )}
          {couponStatus === 'valid' && (
            <p className="text-gold text-xs mt-1">
              الكود شغال ✓ السعر بعد الخصم:{' '}
              {isEgyptOrMena
                ? `${discountedPriceEgp} جنيه`
                : `${discountedPriceUsd?.toFixed(2) ?? '...'} دولار`}
            </p>
          )}
        </div>
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

  if (isEgyptOrMena) {
    const displayPriceEgp = couponStatus === 'valid' ? discountedPriceEgp : price

    return (
      <div>
        {couponField}
        <button
          onClick={() => handlePay('paymob')}
          disabled={loading !== null}
          className="bg-gold text-board font-bold rounded-lg px-6 py-3 hover:bg-gold/90 transition-colors disabled:opacity-50 w-full"
        >
          {loading === 'paymob' ? 'جاري التحويل...' : `ادفع ${displayPriceEgp} جنيه`}
        </button>
        {errorMsg && <p className="text-red-400 text-sm mt-2">{errorMsg}</p>}
      </div>
    )
  }

  const activeUsdPrice = couponStatus === 'valid' ? discountedPriceUsd : usdPrice
  const usdDisplay = activeUsdPrice !== null ? activeUsdPrice.toFixed(2) : '...'

  return (
    <div>
      {couponField}
      <div className="space-y-3">
        <button
          onClick={() => handlePay('paypal')}
          disabled={loading !== null || activeUsdPrice === null}
          className="bg-[#FFC439] text-[#003087] font-bold rounded-lg px-6 py-3 hover:opacity-90 transition-opacity disabled:opacity-50 w-full"
        >
          {loading === 'paypal' ? 'جاري التحويل...' : `PayPal — ${usdDisplay} دولار`}
        </button>
        <button
          onClick={() => handlePay('stripe')}
          disabled={loading !== null || activeUsdPrice === null}
          className="bg-gold text-board font-bold rounded-lg px-6 py-3 hover:bg-gold/90 transition-colors disabled:opacity-50 w-full"
        >
          {loading === 'stripe' ? 'جاري التحويل...' : `ادفع بالبطاقة — ${usdDisplay} دولار`}
        </button>
        {errorMsg && <p className="text-red-400 text-sm mt-2">{errorMsg}</p>}
      </div>
    </div>
  )
}