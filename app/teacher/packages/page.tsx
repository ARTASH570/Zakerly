'use client'

import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useCachedFetch, invalidateCache } from '@/lib/shared/useCachedFetch'

interface TeacherPackage {
  id: string
  name: string
  description: string | null
  price: number
  max_courses: number | null
  max_students: number | null
  live_sessions: boolean
  coupons_enabled: boolean
  priority_support: boolean
}

const PACKAGES_CACHE_KEY = 'teacher-packages'

export default function TeacherPackagesPage() {
  const router = useRouter()

  const fetchPackages = useCallback(async () => {
    const res = await fetch('/api/teacher/packages')
    if (!res.ok) throw new Error('حصل خطأ في تحميل الباقات')
    return (await res.json()) as { packages: TeacherPackage[]; currentPackageId: string | null }
  }, [])

  const { data, loading, refresh } = useCachedFetch(PACKAGES_CACHE_KEY, fetchPackages, 30_000)
  const packages = data?.packages || []
  const currentPackageId = data?.currentPackageId ?? null

  useEffect(() => {
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!sessionData.session) router.push('/login/teacher')
    })
  }, [router])

  const [subscribingId, setSubscribingIdState] = useState<string | null>(null)

  async function subscribe(pkg: TeacherPackage) {
    if (pkg.id === currentPackageId) return
    if (!confirm(`تأكيد الاشتراك في باقة "${pkg.name}"؟`)) return

    setSubscribingIdState(pkg.id)
    try {
      const res = await fetch('/api/teacher/packages/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id }),
      })
      if (res.ok) {
        // الاشتراك اتغيّر - لازم نمسح النسخة المكاشة عشان الطلب الجاي يجيب
        // البيانات الجديدة مش القديمة، وبعدين نجيبها تاني فورًا
        invalidateCache(PACKAGES_CACHE_KEY)
        await refresh()
      } else {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'حصل خطأ في الاشتراك')
      }
    } finally {
      setSubscribingIdState(null)
    }
  }

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl font-bold">الباقات</h1>
          <Link href="/teacher/dashboard" className="text-chalk/60 text-sm hover:text-gold">
            رجوع للداشبورد
          </Link>
        </div>

        {loading ? (
          <p className="text-chalk/50">جاري التحميل...</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {packages.map((pkg, i) => {
              const isCurrent = pkg.id === currentPackageId
              return (
                <div
                  key={pkg.id}
                  style={{ animationDelay: `${i * 80}ms` }}
                  className={`animate-fade-in-up bg-boardLight border rounded-2xl p-6 flex flex-col transition-all duration-300 ease-smooth hover:-translate-y-1 ${
                    isCurrent ? 'border-gold shadow-lg shadow-gold/10' : 'border-line'
                  }`}
                >
                  {isCurrent && (
                    <span className="self-start bg-gold text-board text-xs font-bold px-3 py-1 rounded-full mb-3">
                      باقتك الحالية
                    </span>
                  )}
                  <h3 className="font-display font-bold text-xl mb-1">{pkg.name}</h3>
                  <p className="text-gold font-bold text-2xl mb-3">
                    {pkg.price === 0 ? 'مجانية' : `${pkg.price.toLocaleString()} ج.م`}
                    {pkg.price > 0 && <span className="text-chalk/40 text-sm font-normal"> / شهريًا</span>}
                  </p>
                  <p className="text-chalk/60 text-sm mb-5 leading-relaxed flex-1">{pkg.description}</p>

                  <ul className="space-y-2 text-sm mb-6">
                    <li className="flex items-center gap-2">
                      <CheckDot />
                      {pkg.max_courses ? `حتى ${pkg.max_courses} كورس` : 'كورسات بلا حد'}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckDot />
                      {pkg.max_students ? `حتى ${pkg.max_students} طالب` : 'طلاب بلا حد'}
                    </li>
                    <li className={`flex items-center gap-2 ${!pkg.live_sessions ? 'text-chalk/30' : ''}`}>
                      <CheckDot muted={!pkg.live_sessions} />
                      حصص مباشرة
                    </li>
                    <li className={`flex items-center gap-2 ${!pkg.coupons_enabled ? 'text-chalk/30' : ''}`}>
                      <CheckDot muted={!pkg.coupons_enabled} />
                      كوبونات خصم
                    </li>
                    <li className={`flex items-center gap-2 ${!pkg.priority_support ? 'text-chalk/30' : ''}`}>
                      <CheckDot muted={!pkg.priority_support} />
                      دعم فني بأولوية
                    </li>
                  </ul>

                  <button
                    onClick={() => subscribe(pkg)}
                    disabled={isCurrent || subscribingId === pkg.id}
                    className={`w-full font-bold rounded-lg py-2.5 text-sm transition-all duration-200 ease-smooth disabled:opacity-60 active:scale-95 ${
                      isCurrent
                        ? 'bg-line text-chalk/50 cursor-default'
                        : 'bg-gold text-board hover:bg-gold/90 hover:scale-[1.02]'
                    }`}
                  >
                    {subscribingId === pkg.id ? 'جاري الاشتراك...' : isCurrent ? 'مفعّلة حاليًا' : 'اشترك'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

function CheckDot({ muted = false }: { muted?: boolean }) {
  return (
    <span
      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
        muted ? 'bg-chalk/10' : 'bg-gold/20 text-gold'
      }`}
    >
      {!muted && (
        <svg viewBox="0 0 24 24" fill="none" className="w-2.5 h-2.5">
          <path d="m5 12 5 5 9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}
