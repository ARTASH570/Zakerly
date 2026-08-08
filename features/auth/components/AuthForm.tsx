'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

interface AuthFormProps {
  // لو اتحددت هنا، الصفحة بتبقى مخصصة لدور واحد بس (مفيش تاب اختيار)
  fixedRole?: 'teacher' | 'student'
}

export default function AuthForm({ fixedRole }: AuthFormProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const defaultRole = searchParams.get('role') === 'student' ? 'student' : 'teacher'

  const [role, setRole] = useState<'teacher' | 'student'>(fixedRole ?? defaultRole)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [fullName, setFullName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login'
      const body = isSignUp
        ? { email, password, fullName, role, parentPhone: role === 'student' ? parentPhone : undefined }
        : { email, password }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'حصل خطأ، حاول تاني')
        return
      }

      if (isSignUp) {
        // ⚠️ بعد التسجيل، الحساب محتاج تأكيد إيميل قبل ما يقدر يدخل -
        // نوجّهه لصفحة توضحله كده بدل ما نديله انطباع غلط إنه دخل فعليًا
        router.push(`/register-success?email=${encodeURIComponent(email)}`)
        return
      }

      // ⚠️ الـ API route عمل تسجيل الدخول من خلال السيرفر وحط الكوكيز صح،
      // لكن عميل المتصفح (supabase) لسه محتاج يعرف بالجلسة الجديدة دي، فبنجدده يقرأها من الكوكيز
      await supabase.auth.getSession()

      // بنوجّه حسب الدور الحقيقي اللي السيرفر أكّده (مش حسب التاب اللي المستخدم
      // ضاغط عليه في الواجهة) - عشان لو حد سجّل دخول وهو دايس بالغلط على تاب
      // "معلم" رغم إن حسابه طالب، يتوجّه لمكانه الصح مش لداشبورد فاضي/غلط
      const verifiedRole = data.role || role
      const destination =
        verifiedRole === 'admin'
          ? '/admin/dashboard'
          : verifiedRole === 'teacher'
            ? '/teacher/dashboard'
            : '/student/dashboard'
window.location.href = destination    } catch (err) {
      setErrorMsg('حصل خطأ، حاول تاني')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-boardLight border border-line rounded-lg px-4 py-3 text-chalk placeholder:text-chalk/40 transition-all duration-200 ease-smooth focus:outline-none focus:border-gold focus:scale-[1.01]'

  return (
    <main className="min-h-screen bg-board flex items-center justify-center px-6">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8 animate-fade-in-down">
          <h1 className="font-display text-2xl font-bold text-chalk mb-2">Zakerly</h1>
          <p className="text-chalk/60">
            {isSignUp ? 'اعمل حساب جديد' : 'سجّل دخولك'}
            {fixedRole ? (fixedRole === 'teacher' ? ' - معلم' : ' - طالب') : ''}
          </p>
        </div>

        {/* اختيار الدور - يظهر بس لو الصفحة عامة مش مخصصة لدور واحد */}
        {!fixedRole && (
          <div className="flex bg-boardLight rounded-lg p-1 mb-6 border border-line">
            <button
              type="button"
              onClick={() => setRole('teacher')}
              className={`flex-1 py-2 rounded-md text-sm font-bold transition-all duration-200 ease-smooth ${
                role === 'teacher' ? 'bg-gold text-board' : 'text-chalk/60 hover:text-chalk'
              }`}
            >
              معلم
            </button>
            <button
              type="button"
              onClick={() => setRole('student')}
              className={`flex-1 py-2 rounded-md text-sm font-bold transition-all duration-200 ease-smooth ${
                role === 'student' ? 'bg-gold text-board' : 'text-chalk/60 hover:text-chalk'
              }`}
            >
              طالب
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          {isSignUp && (
            <input
              type="text"
              placeholder="الاسم بالكامل"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className={`${inputClass} animate-scale-in`}
            />
          )}
          {isSignUp && role === 'student' && (
            <input
              type="tel"
              placeholder="رقم تليفون ولي الأمر (لإرسال التقارير)"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              required
              className={`${inputClass} animate-scale-in`}
            />
          )}
          <input
            type="email"
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="password"
            placeholder="كلمة السر"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className={inputClass}
          />

          {errorMsg && <p className="text-red-400 text-sm animate-fade-in-up">{errorMsg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-board font-bold rounded-lg py-3 transition-all duration-200 ease-smooth hover:bg-gold/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? 'جاري التحميل...' : isSignUp ? 'إنشاء الحساب' : 'دخول'}
          </button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center text-chalk/60 text-sm mt-6 transition-colors hover:text-gold"
        >
          {isSignUp ? 'عندك حساب؟ سجّل دخولك' : 'لسه معملتش حساب؟ اعمل واحد'}
        </button>

        {!isSignUp && (
          <Link
            href="/forgot-password"
            className="block text-center text-chalk/40 text-sm mt-3 transition-colors hover:text-gold"
          >
            نسيت كلمة السر؟
          </Link>
        )}
      </div>
    </main>
  )
}
