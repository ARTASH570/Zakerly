'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV_ITEMS } from '@/features/admin/navItems'

export default function AdminSettingsPage() {
  const router = useRouter()
  const [adminName, setAdminName] = useState('')
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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

    const res = await fetch('/api/admin/settings/maintenance')
    if (res.status === 401 || res.status === 403) {
      setError('مش متاح ليك الوصول للصفحة دي')
      setLoading(false)
      return
    }
    if (res.ok) {
      const json = await res.json()
      setMaintenanceMode(json.maintenanceMode)
      setMessage(json.maintenanceMessage || '')
    } else {
      setError('حصل خطأ في تحميل الإعدادات')
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function toggle() {
    const turningOn = !maintenanceMode
    if (
      turningOn &&
      !confirm('متأكد إنك عايز تفعّل وضع الصيانة؟ كل المعلمين والطلاب هيتحوّلوا لصفحة "تحت الصيانة" فورًا، وميقدروش يستخدموا المنصة لحد ما تلغيها.')
    ) {
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: turningOn, message }),
      })
      if (res.ok) {
        const json = await res.json()
        setMaintenanceMode(json.maintenanceMode)
      } else {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'حصل خطأ')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell navItems={ADMIN_NAV_ITEMS} userName={adminName || 'أدمن'} roleLabel="حساب أدمن">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">الإعدادات</h1>
        <p className="text-ink/50 text-sm mt-1">إعدادات عامة على مستوى المنصة كلها</p>
      </div>

      {loading ? (
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : (
        <div className="bg-paper border border-ink/10 rounded-2xl p-6 max-w-xl">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-display font-bold mb-1">وضع الصيانة</h3>
              <p className="text-ink/50 text-sm">
                {maintenanceMode
                  ? 'المنصة مقفولة دلوقتي على الكل عدا الأدمن'
                  : 'المنصة شغالة عادي لكل المستخدمين'}
              </p>
            </div>
            <span
              className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full ${
                maintenanceMode ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
              }`}
            >
              {maintenanceMode ? 'مقفولة' : 'شغالة'}
            </span>
          </div>

          <div className="mb-4">
            <label className="text-ink/40 text-xs mb-1 block">الرسالة اللي هتظهر للمستخدمين وقت الصيانة</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="المنصة تحت الصيانة دلوقتي، هنرجعلكم قريب."
              className="w-full bg-ink/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold resize-none"
            />
          </div>

          <button
            onClick={toggle}
            disabled={saving}
            className={`w-full font-bold rounded-lg py-3 transition-all duration-200 ease-smooth disabled:opacity-50 active:scale-[0.98] ${
              maintenanceMode
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {saving ? 'جاري التنفيذ...' : maintenanceMode ? 'إلغاء وضع الصيانة' : 'تفعيل وضع الصيانة'}
          </button>
        </div>
      )}
    </DashboardShell>
  )
}
