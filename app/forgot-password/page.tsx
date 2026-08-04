'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setErrorMsg('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'حصل خطأ')
        return
      }
      setMessage(data.message)
    } catch {
      setErrorMsg('حصل خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-board flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="font-display text-2xl font-bold text-chalk mb-2 text-center">
          نسيت كلمة السر؟
        </h1>
        <p className="text-chalk/60 mb-8 text-center">
          اكتب إيميلك وهنبعتلك رابط تقدر تعمل بيه كلمة سر جديدة
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-boardLight border border-line rounded-lg px-4 py-3 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
          />

          {message && <p className="text-gold text-sm">{message}</p>}
          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-board font-bold rounded-lg py-3 disabled:opacity-50"
          >
            {loading ? 'جاري الإرسال...' : 'ابعت رابط الاستعادة'}
          </button>
        </form>

        <Link
          href="/login"
          className="block text-center text-chalk/60 text-sm mt-6 hover:text-gold"
        >
          رجوع لتسجيل الدخول
        </Link>
      </div>
    </main>
  )
}
