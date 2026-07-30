'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

interface Coupon {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  course_id: string | null
  usage_limit: number | null
  usage_count: number
  expires_at: string | null
  is_active: boolean
}

interface Course {
  id: string
  title: string
}

export default function TeacherCouponsPage() {
  const router = useRouter()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [courseId, setCourseId] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [oneTimePerStudent, setOneTimePerStudent] = useState(true)

  async function loadData() {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      router.push('/login?role=teacher')
      return
    }

    const userId = sessionData.session.user.id

    const { data: couponsData } = await supabase
      .from('coupons')
      .select('id, code, discount_type, discount_value, course_id, usage_limit, usage_count, expires_at, is_active')
      .eq('teacher_id', userId)
      .order('created_at', { ascending: false })

    const { data: coursesData } = await supabase
      .from('courses')
      .select('id, title')
      .eq('teacher_id', userId)

    setCoupons(couponsData || [])
    setCourses(coursesData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/coupons/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          discountType,
          discountValue: Number(discountValue),
          courseId: courseId || null,
          minPrice: minPrice ? Number(minPrice) : null,
          usageLimit: usageLimit ? Number(usageLimit) : null,
          oneTimePerStudent,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'حصل خطأ')
        return
      }

      setCode('')
      setDiscountValue('')
      setCourseId('')
      setMinPrice('')
      setUsageLimit('')
      setExpiresAt('')
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl font-bold">الكوبونات</h1>
          <Link href="/teacher/dashboard" className="text-chalk/60 text-sm hover:text-gold">
            رجوع للداشبورد
          </Link>
        </div>

        <form onSubmit={handleCreate} className="bg-boardLight border border-line rounded-xl p-6 mb-8 space-y-3">
          <h3 className="font-display font-bold mb-2">كوبون جديد</h3>

          <input
            type="text"
            placeholder="كود الكوبون (مثلاً SAVE20)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            className="w-full bg-board border border-line rounded-lg px-4 py-2 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
              className="bg-board border border-line rounded-lg px-3 py-2 text-chalk text-sm focus:outline-none focus:border-gold"
            >
              <option value="percentage">نسبة مئوية %</option>
              <option value="fixed">مبلغ ثابت ج.م</option>
            </select>
            <input
              type="number"
              placeholder={discountType === 'percentage' ? 'مثلاً 20' : 'مثلاً 50'}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              required
              min={0}
              className="bg-board border border-line rounded-lg px-3 py-2 text-chalk placeholder:text-chalk/40 text-sm focus:outline-none focus:border-gold"
            />
          </div>

          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full bg-board border border-line rounded-lg px-3 py-2 text-chalk text-sm focus:outline-none focus:border-gold"
          >
            <option value="">شغال على كل كورساتي</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} بس
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-chalk/50 text-xs mb-1 block">حد أدنى للسعر (اختياري)</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                min={0}
                className="w-full bg-board border border-line rounded-lg px-3 py-2 text-chalk text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="text-chalk/50 text-xs mb-1 block">حد الاستخدام (اختياري)</label>
              <input
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                min={1}
                className="w-full bg-board border border-line rounded-lg px-3 py-2 text-chalk text-sm focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          <div>
            <label className="text-chalk/50 text-xs mb-1 block">تاريخ الانتهاء (اختياري)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-board border border-line rounded-lg px-3 py-2 text-chalk text-sm focus:outline-none focus:border-gold"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-chalk/70 cursor-pointer">
            <input
              type="checkbox"
              checked={oneTimePerStudent}
              onChange={(e) => setOneTimePerStudent(e.target.checked)}
              className="accent-gold"
            />
            كل طالب يستخدمه مرة واحدة بس
          </label>

          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gold text-board font-bold rounded-lg py-3 disabled:opacity-50"
          >
            {saving ? 'جاري الإنشاء...' : 'أنشئ الكوبون'}
          </button>
        </form>

        {loading && <p className="text-chalk/50">جاري التحميل...</p>}

        <div className="space-y-2">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="flex items-center justify-between bg-boardLight border border-line rounded-lg px-4 py-3"
            >
              <div>
                <p className="font-bold text-gold">{coupon.code}</p>
                <p className="text-chalk/50 text-xs">
                  {coupon.discount_type === 'percentage'
                    ? `${coupon.discount_value}%`
                    : `${coupon.discount_value} ج.م`}
                  {' · '}
                  {courses.find((c) => c.id === coupon.course_id)?.title || 'كل الكورسات'}
                </p>
              </div>
              <p className="text-chalk/40 text-xs">
                {coupon.usage_count}
                {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''} استخدام
              </p>
            </div>
          ))}
          {!loading && coupons.length === 0 && (
            <p className="text-chalk/50 text-sm">لسه معملتش أي كوبون</p>
          )}
        </div>
      </div>
    </main>
  )
}
