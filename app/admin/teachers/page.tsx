'use client'

import { useState } from 'react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV_ITEMS } from '@/features/admin/navItems'
import { useAdminOverview } from '@/features/admin/useAdminOverview'

export default function AdminTeachersPage() {
  const { adminName, data, loading, error, reload } = useAdminOverview()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function toggleTeacher(id: string) {
    setBusyId(id)
    await fetch(`/api/admin/teachers/${id}/toggle-disable`, { method: 'POST' })
    await reload()
    setBusyId(null)
  }

  return (
    <DashboardShell navItems={ADMIN_NAV_ITEMS} userName={adminName || 'أدمن'} roleLabel="حساب أدمن">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">المعلمين</h1>
        <p className="text-ink/50 text-sm mt-1">{data ? `${data.totalTeachers} معلم مسجل` : ''}</p>
      </div>

      {loading ? (
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      ) : error || !data ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : data.teachers.length === 0 ? (
        <div className="bg-paper border border-ink/10 rounded-2xl p-8 text-center">
          <p className="text-ink/50">مفيش معلمين مسجلين لسه</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.teachers.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-4 bg-paper border border-ink/10 rounded-xl px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{t.full_name}</p>
                <p className="text-ink/40 text-xs mt-0.5">{t.subject || 'بدون تخصص'}</p>
              </div>
              <button
                onClick={() => toggleTeacher(t.id)}
                disabled={busyId === t.id}
                className={`text-sm font-bold px-3.5 py-1.5 rounded-lg disabled:opacity-50 shrink-0 ${
                  t.is_disabled ? 'bg-gold text-board' : 'border border-red-300 text-red-600 hover:bg-red-50'
                }`}
              >
                {busyId === t.id ? '...' : t.is_disabled ? 'إعادة تفعيل' : 'تعطيل'}
              </button>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  )
}
