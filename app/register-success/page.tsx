'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function RegisterSuccessContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  return (
    <main className="min-h-screen bg-board flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="text-5xl mb-4">📩</div>
        <h1 className="font-display text-2xl font-bold text-chalk mb-3">
          كدة خطوة واحدة بس باقية!
        </h1>
        <p className="text-chalk/70 mb-2">بعتنالك إيميل تأكيد على:</p>
        <p className="text-gold font-bold mb-6">{email}</p>
        <p className="text-chalk/60 text-sm mb-8">
          افتح الإيميل ودوس على رابط التأكيد عشان تقدر تسجل دخولك.
          لو ماشفتوش، اتأكد من مجلد الـ Spam / الرسائل غير المرغوب فيها.
        </p>
        <Link
          href="/login"
          className="bg-gold text-board font-bold rounded-lg px-6 py-3 inline-block"
        >
          روح لصفحة تسجيل الدخول
        </Link>
      </div>
    </main>
  )
}

export default function RegisterSuccessPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-board" />}>
      <RegisterSuccessContent />
    </Suspense>
  )
}
