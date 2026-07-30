'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      // ⚠️ لازم نتأكد الأول إن فيه جلسة "recovery" فعلية اتحطت من رابط الإيميل
      // (المكتبة بتتعامل مع الـ token اللي في الرابط تلقائيًا وتعمل جلسة مؤقتة)
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        setErrorMsg('الرابط منتهي أو غير صحيح، اطلب رابط استعادة جديد')
        setLoading(false)
        return
      }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'حصل خطأ')
        return
      }

      setDone(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch {
      setErrorMsg('حصل خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <main className="min-h-screen bg-board flex items-center justify-center px-6">
        <p className="text-gold text-lg font-bold">تم تغيير كلمة السر ✓ هتحول دلوقتي...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-board flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="font-display text-2xl font-bold text-chalk mb-8 text-center">
          كلمة سر جديدة
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="كلمة السر الجديدة"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-boardLight border border-line rounded-lg px-4 py-3 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
          />

          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-board font-bold rounded-lg py-3 disabled:opacity-50"
          >
            {loading ? 'جاري الحفظ...' : 'احفظ كلمة السر الجديدة'}
          </button>
        </form>
      </div>
    </main>
  )
}
