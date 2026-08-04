'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV_ITEMS } from '@/features/admin/navItems'

interface AdminRow {
  id: string
  full_name: string
  email: string | null
  created_at: string
}

export default function AdminAdminsPage() {
  const router = useRouter()
  const [adminName, setAdminName] = useState('')
  const [currentAdminId, setCurrentAdminId] = useState('')
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

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

    const res = await fetch('/api/admin/admins')
    if (res.status === 403 || res.status === 401) {
      setError('مش متاح ليك الوصول للصفحة دي')
      setLoading(false)
      return
    }
    if (res.ok) {
      const json = await res.json()
      setAdmins(json.admins)
      setCurrentAdminId(json.currentAdminId)
    } else {
      setError('حصل خطأ في تحميل البيانات')
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function handlePromote(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!email.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName: fullName.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'حصل خطأ')
        return
      }
      setEmail('')
      setFullName('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('متأكد إنك عايز تشيل صلاحية الأدمن من الحساب ده؟')) return
    setBusyId(id)
    const res = await fetch(`/api/admin/admins/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) alert(data.error || 'حصل خطأ')
    await load()
    setBusyId(null)
  }

  return (
    <DashboardShell navItems={ADMIN_NAV_ITEMS} userName={adminName || 'أدمن'} roleLabel="حساب أدمن">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">إدارة الأدمنز</h1>
        <p className="text-ink/50 text-sm mt-1">رقّي حساب معلم أو طالب مسجل عندك بالفعل ليبقى أدمن</p>
      </div>

      {loading ? (
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-2">
            {admins.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 bg-paper border border-ink/10 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">
                    {a.full_name} {a.id === currentAdminId && <span className="text-gold text-xs">(انت)</span>}
                  </p>
                  <p className="text-ink/40 text-xs mt-0.5">{a.email || '—'}</p>
                </div>
                {a.id !== currentAdminId && (
                  <button
                    onClick={() => handleRemove(a.id)}
                    disabled={busyId === a.id}
                    className="text-sm font-bold border border-red-300 text-red-600 hover:bg-red-50 px-3.5 py-1.5 rounded-lg disabled:opacity-50 shrink-0"
                  >
                    {busyId === a.id ? '...' : 'شيل الصلاحية'}
                  </button>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handlePromote} className="bg-paper border border-ink/10 rounded-2xl p-5 space-y-4 h-fit">
            <h3 className="font-display font-bold">ترقية حساب لأدمن</h3>
            {formError && <p className="text-red-600 text-sm">{formError}</p>}
            <p className="text-ink/50 text-xs">
              لازم يكون عندهم حساب مسجل بالفعل (معلم أو طالب) بنفس الإيميل ده
            </p>
            <div>
              <label className="block text-sm font-bold mb-1.5">الإيميل</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full border border-ink/15 rounded-xl px-4 py-2.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5">الاسم (اختياري)</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="هياخده من حسابه لو سايبه فاضي"
                className="w-full border border-ink/15 rounded-xl px-4 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-gold text-board font-bold text-sm px-5 py-2.5 rounded-xl w-full hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'جاري الترقية...' : 'رقّي لأدمن'}
            </button>
          </form>
        </div>
      )}
    </DashboardShell>
  )
}
