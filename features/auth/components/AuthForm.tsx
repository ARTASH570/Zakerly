'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

interface AuthFormProps {
  // لو اتحددت هنا، الصفحة بتبقى مخصصة لدور واحد بس (مفيش تاب اختيار)
  fixedRole?: 'teacher' | 'student'
}

// شروط قوة كلمة السر - كل شرط بييشتغل عليه دالة تحقق بسيطة
const PASSWORD_REQUIREMENTS = [
  { label: '8 حروف على الأقل', test: (pw: string) => pw.length >= 8 },
  { label: 'حرف كبير (A-Z)', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'حرف صغير (a-z)', test: (pw: string) => /[a-z]/.test(pw) },
  { label: 'رقم واحد على الأقل', test: (pw: string) => /[0-9]/.test(pw) },
]

export default function AuthForm({ fixedRole }: AuthFormProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const defaultRole = searchParams.get('role') === 'student' ? 'student' : 'teacher'

  const [role, setRole] = useState<'teacher' | 'student'>(fixedRole ?? defaultRole)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [fullName, setFullName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const allRequirementsMet = PASSWORD_REQUIREMENTS.every((r) => r.test(password))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    // في وضع إنشاء الحساب، لازم كل شروط كلمة السر تتحقق قبل ما نبعت الطلب
    if (isSignUp && !allRequirementsMet) {
      setErrorMsg('كلمة السر لازم تستوفي كل الشروط الموضحة تحت')
      return
    }

    setLoading(true)

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
      window.location.href = destination
    } catch (err) {
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

        {searchParams.get('confirmed') === 'true' && !isSignUp && (
          <p className="bg-green-500/10 text-green-400 text-sm text-center rounded-lg py-2.5 px-4 mb-6 animate-fade-in-down">
            تم تأكيد حسابك بنجاح ✓ سجّل دخولك دلوقتي
          </p>
        )}

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

          {/* حقل كلمة السر مع زرار إظهار/إخفاء */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="كلمة السر"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isSignUp ? 8 : undefined}
              className={`${inputClass} pl-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-chalk/40 hover:text-gold transition-colors"
              aria-label={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
              tabIndex={-1}
            >
              {showPassword ? (
                // عين مشطوبة (إخفاء)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                // عين عادية (إظهار)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {/* قايمة شروط كلمة السر - تظهر بس وقت إنشاء حساب جديد */}
          {isSignUp && (
            <ul className="space-y-1.5 px-1 animate-fade-in-up">
              {PASSWORD_REQUIREMENTS.map((req) => {
                const met = req.test(password)
                return (
                  <li
                    key={req.label}
                    className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
                      met ? 'text-green-400' : 'text-chalk/40'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-4 h-4 shrink-0">
                      {met ? '✓' : '✕'}
                    </span>
                    {req.label}
                  </li>
                )
              })}
            </ul>
          )}

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
