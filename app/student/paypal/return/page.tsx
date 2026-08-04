'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function PaypalReturnContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('token') // PayPal بيرجع رقم الطلب في باراميتر اسمه token

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [courseId, setCourseId] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) {
      setStatus('error')
      setErrorMsg('رابط غير صحيح')
      return
    }

    async function confirmPayment() {
      try {
        const res = await fetch('/api/payments/paypal/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        })
        const data = await res.json()

        if (!res.ok) {
          setStatus('error')
          setErrorMsg(data.error || 'حصل خطأ في تأكيد الدفع')
          return
        }

        setCourseId(data.courseId)
        setStatus('success')
      } catch {
        setStatus('error')
        setErrorMsg('حصل خطأ في الاتصال')
      }
    }

    confirmPayment()
  }, [orderId])

  return (
    <main className="min-h-screen bg-board text-chalk flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {status === 'loading' && <p className="text-chalk/60">جاري تأكيد الدفع...</p>}

        {status === 'success' && (
          <>
            <p className="text-gold text-2xl font-bold mb-3">تم الدفع بنجاح ✓</p>
            <p className="text-chalk/60 mb-6">اشتراكك في الكورس بقى مفعّل، تقدر تشوف الفيديوهات دلوقتي.</p>
            <Link
              href={courseId ? `/student/courses/${courseId}/watch` : '/student/dashboard'}
              className="bg-gold text-board font-bold rounded-lg px-6 py-3 inline-block"
            >
              روح للكورس
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="text-red-400 text-xl font-bold mb-3">حصل خطأ</p>
            <p className="text-chalk/60 mb-6">{errorMsg}</p>
            <button
              onClick={() => router.push('/student/dashboard')}
              className="border border-line rounded-lg px-6 py-3"
            >
              رجوع للداشبورد
            </button>
          </>
        )}
      </div>
    </main>
  )
}

export default function PaypalReturnPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-board" />}>
      <PaypalReturnContent />
    </Suspense>
  )
}
