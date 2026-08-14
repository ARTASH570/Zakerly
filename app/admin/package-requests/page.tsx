'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV_ITEMS } from '@/features/admin/navItems'

interface PackageRequest {
  id: string
  amount: number
  reference_number: string | null
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  reviewed_at: string | null
  created_at: string
  teachers: { full_name: string; phone: string | null } | null
  teacher_packages: { name: string; price: number } | null
}

export default function AdminPackageRequestsPage() {
  const router = useRouter()
  const [adminName, setAdminName] = useState('')
  const [requests, setRequests] = useState<PackageRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')

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

    const res = await fetch('/api/admin/package-requests')
    if (res.status === 403 || res.status === 401) {
      setError('مش متاح ليك الوصول للصفحة دي')
      setLoading(false)
      return
    }
    if (res.ok) {
      const json = await res.json()
      setRequests(json.requests)
    } else {
      setError('حصل خطأ في تحميل البيانات')
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function handleApprove(id: string) {
    if (!confirm('متأكد إنك استلمت الفلوس فعلاً وعايز تفعّل الباقة دي للمعلم؟')) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/package-requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (!res.ok) alert(data.error || 'حصل خطأ')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/package-requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', note: rejectNote.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) alert(data.error || 'حصل خطأ')
      setRejectingId(null)
      setRejectNote('')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const pending = requests.filter((r) => r.status === 'pending')
  const reviewed = requests.filter((r) => r.status !== 'pending')

  return (
    <DashboardShell navItems={ADMIN_NAV_ITEMS} userName={adminName || 'أدمن'} roleLabel="حساب أدمن">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">طلبات تفعيل الباقات</h1>
        <p className="text-ink/50 text-sm mt-1">
          راجع الرقم المرجعي مع كشف الحساب/المحفظة، وبعدين وافق لتفعيل الباقة أو ارفض
        </p>
      </div>

      {loading ? (
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="font-bold text-sm text-ink/60 mb-3">قيد المراجعة ({pending.length})</h2>
            {pending.length === 0 && <p className="text-ink/40 text-sm">مفيش طلبات حاليًا</p>}
            <div className="space-y-3">
              {pending.map((r) => (
                <div key={r.id} className="bg-paper border border-ink/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-sm">
                        {r.teacher_packages?.name || '—'}{' '}
                        <span className="text-ink/40 font-normal">({r.amount} ج.م)</span>
                      </p>
                      <p className="text-ink/50 text-xs mt-0.5">
                        المعلم: {r.teachers?.full_name || '—'}
                        {r.teachers?.phone && ` · ${r.teachers.phone}`}
                      </p>
                      <p className="text-ink/70 text-sm mt-2 bg-ink/5 rounded-lg px-3 py-2 inline-block">
                        الرقم المرجعي: <span className="font-bold">{r.reference_number || '—'}</span>
                      </p>
                      {r.note && (
                        <p className="text-ink/60 text-xs mt-2">ملاحظة: {r.note}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(r.id)}
                        disabled={busyId === r.id}
                        className="text-sm font-bold border border-green-300 text-green-700 hover:bg-green-50 px-3.5 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        {busyId === r.id ? '...' : 'موافقة وتفعيل'}
                      </button>
                      <button
                        onClick={() => setRejectingId(rejectingId === r.id ? null : r.id)}
                        disabled={busyId === r.id}
                        className="text-sm font-bold border border-red-300 text-red-600 hover:bg-red-50 px-3.5 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        رفض
                      </button>
                    </div>
                  </div>

                  {rejectingId === r.id && (
                    <div className="mt-3 pt-3 border-t border-ink/10 flex gap-2">
                      <input
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="سبب الرفض (اختياري، هيوصل للمعلم)"
                        className="flex-1 border border-ink/15 rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => handleReject(r.id)}
                        disabled={busyId === r.id}
                        className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
                      >
                        تأكيد الرفض
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {reviewed.length > 0 && (
            <div>
              <h2 className="font-bold text-sm text-ink/60 mb-3">طلبات سابقة</h2>
              <div className="space-y-2">
                {reviewed.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-4 bg-paper border border-ink/10 rounded-xl px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        {r.teachers?.full_name || '—'} · {r.teacher_packages?.name || '—'}
                      </p>
                      <p className="text-ink/40 text-xs mt-0.5">{r.amount} ج.م</p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                        r.status === 'approved'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {r.status === 'approved' ? 'اتوافق عليه' : 'اترفض'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  )
}
