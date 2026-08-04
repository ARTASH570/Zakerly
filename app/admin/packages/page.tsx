'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV_ITEMS } from '@/features/admin/navItems'

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
  is_active: boolean
  subscriberCount: number
}

// نموذج التعديل المحلي لكل باقة - بنستخدم string للأرقام في الفورم عشان
// حقل الإدخال يقدر يفضل فاضي وإحنا بنكتب فيه (مش يتحول لصفر فورًا)
interface PackageDraft {
  name: string
  description: string
  price: string
  maxCourses: string // فاضي = بلا حد (unlimited)
  maxStudents: string
  liveSessions: boolean
  couponsEnabled: boolean
  prioritySupport: boolean
  isActive: boolean
}

function toDraft(p: TeacherPackage): PackageDraft {
  return {
    name: p.name,
    description: p.description || '',
    price: String(p.price),
    maxCourses: p.max_courses === null ? '' : String(p.max_courses),
    maxStudents: p.max_students === null ? '' : String(p.max_students),
    liveSessions: p.live_sessions,
    couponsEnabled: p.coupons_enabled,
    prioritySupport: p.priority_support,
    isActive: p.is_active,
  }
}

export default function AdminPackagesPage() {
  const router = useRouter()
  const [adminName, setAdminName] = useState('')
  const [packages, setPackages] = useState<TeacherPackage[]>([])
  const [drafts, setDrafts] = useState<Record<string, PackageDraft>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login')
      return
    }
    const { data: adminRow } = await supabase
      .from('admins')
      .select('full_name')
      .eq('id', sessionData.session.user.id)
      .maybeSingle()
    setAdminName(adminRow?.full_name || '')

    const res = await fetch('/api/admin/packages')
    if (res.status === 401 || res.status === 403) {
      setError('مش متاح ليك الوصول للصفحة دي')
      setLoading(false)
      return
    }
    if (res.ok) {
      const json = await res.json()
      setPackages(json.packages)
      const nextDrafts: Record<string, PackageDraft> = {}
      for (const p of json.packages as TeacherPackage[]) nextDrafts[p.id] = toDraft(p)
      setDrafts(nextDrafts)
    } else {
      setError('حصل خطأ في تحميل الباقات')
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  function updateDraft(id: string, patch: Partial<PackageDraft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function save(pkg: TeacherPackage) {
    const draft = drafts[pkg.id]
    if (!draft) return

    setSavingId(pkg.id)
    setSavedId(null)
    try {
      const res = await fetch(`/api/admin/packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          price: Number(draft.price),
          maxCourses: draft.maxCourses.trim() === '' ? null : Number(draft.maxCourses),
          maxStudents: draft.maxStudents.trim() === '' ? null : Number(draft.maxStudents),
          liveSessions: draft.liveSessions,
          couponsEnabled: draft.couponsEnabled,
          prioritySupport: draft.prioritySupport,
          isActive: draft.isActive,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setPackages((prev) => prev.map((p) => (p.id === pkg.id ? { ...p, ...json.package } : p)))
        setSavedId(pkg.id)
        setTimeout(() => setSavedId((cur) => (cur === pkg.id ? null : cur)), 2000)
      } else {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'حصل خطأ في الحفظ')
      }
    } finally {
      setSavingId(null)
    }
  }

  return (
    <DashboardShell navItems={ADMIN_NAV_ITEMS} userName={adminName || 'أدمن'} roleLabel="حساب أدمن">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">باقات المعلمين</h1>
        <p className="text-ink/50 text-sm mt-1">
          عدّل السعر والوصف والصلاحيات لكل باقة - التعديل بيبان للمعلمين فورًا
        </p>
      </div>

      {loading ? (
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          {packages.map((pkg) => {
            const d = drafts[pkg.id]
            if (!d) return null
            return (
              <div
                key={pkg.id}
                className={`bg-paper border rounded-2xl p-5 flex flex-col gap-4 transition-shadow duration-300 hover:shadow-md ${
                  d.isActive ? 'border-ink/10' : 'border-red-200 opacity-70'
                }`}
              >
                <div>
                  <label className="text-ink/40 text-xs mb-1 block">اسم الباقة</label>
                  <input
                    value={d.name}
                    onChange={(e) => updateDraft(pkg.id, { name: e.target.value })}
                    className="w-full font-display font-bold text-lg bg-transparent border-b border-ink/10 pb-1 focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="text-ink/40 text-xs mb-1 block">السعر الشهري (ج.م)</label>
                  <input
                    type="number"
                    min={0}
                    value={d.price}
                    onChange={(e) => updateDraft(pkg.id, { price: e.target.value })}
                    className="w-full bg-ink/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div>
                  <label className="text-ink/40 text-xs mb-1 block">الوصف</label>
                  <textarea
                    value={d.description}
                    onChange={(e) => updateDraft(pkg.id, { description: e.target.value })}
                    rows={3}
                    className="w-full bg-ink/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-ink/40 text-xs mb-1 block">حد الكورسات</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="بلا حد"
                      value={d.maxCourses}
                      onChange={(e) => updateDraft(pkg.id, { maxCourses: e.target.value })}
                      className="w-full bg-ink/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                  </div>
                  <div>
                    <label className="text-ink/40 text-xs mb-1 block">حد الطلاب</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="بلا حد"
                      value={d.maxStudents}
                      onChange={(e) => updateDraft(pkg.id, { maxStudents: e.target.value })}
                      className="w-full bg-ink/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                  </div>
                </div>

                <div className="space-y-2 border-t border-ink/10 pt-3">
                  <label className="flex items-center justify-between text-sm cursor-pointer">
                    <span>حصص مباشرة</span>
                    <input
                      type="checkbox"
                      checked={d.liveSessions}
                      onChange={(e) => updateDraft(pkg.id, { liveSessions: e.target.checked })}
                      className="w-4 h-4 accent-gold"
                    />
                  </label>
                  <label className="flex items-center justify-between text-sm cursor-pointer">
                    <span>كوبونات خصم</span>
                    <input
                      type="checkbox"
                      checked={d.couponsEnabled}
                      onChange={(e) => updateDraft(pkg.id, { couponsEnabled: e.target.checked })}
                      className="w-4 h-4 accent-gold"
                    />
                  </label>
                  <label className="flex items-center justify-between text-sm cursor-pointer">
                    <span>دعم فني بأولوية</span>
                    <input
                      type="checkbox"
                      checked={d.prioritySupport}
                      onChange={(e) => updateDraft(pkg.id, { prioritySupport: e.target.checked })}
                      className="w-4 h-4 accent-gold"
                    />
                  </label>
                  <label className="flex items-center justify-between text-sm cursor-pointer">
                    <span>الباقة مفعّلة (تظهر للمعلمين)</span>
                    <input
                      type="checkbox"
                      checked={d.isActive}
                      onChange={(e) => updateDraft(pkg.id, { isActive: e.target.checked })}
                      className="w-4 h-4 accent-gold"
                    />
                  </label>
                </div>

                <p className="text-ink/40 text-xs">{pkg.subscriberCount} معلم مشترك حاليًا</p>

                <button
                  onClick={() => save(pkg)}
                  disabled={savingId === pkg.id}
                  className={`w-full font-bold rounded-lg py-2.5 text-sm transition-all duration-200 ease-smooth disabled:opacity-50 ${
                    savedId === pkg.id
                      ? 'bg-green-600 text-white'
                      : 'bg-gold text-board hover:bg-gold/90 active:scale-95'
                  }`}
                >
                  {savingId === pkg.id ? 'جاري الحفظ...' : savedId === pkg.id ? 'اتحفظت ✓' : 'حفظ التعديلات'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </DashboardShell>
  )
}
