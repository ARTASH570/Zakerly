'use client'

import { useState } from 'react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV_ITEMS } from '@/features/admin/navItems'
import { useAdminOverview } from '@/features/admin/useAdminOverview'

const STATUS_LABELS: Record<string, string> = {
  success: 'ناجحة',
  failed: 'فاشلة',
  pending: 'قيد الانتظار',
  refunded: 'مستردة',
}

export default function AdminPaymentsPage() {
  const { adminName, data, loading, error, reload } = useAdminOverview()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function refundPayment(id: string) {
    if (!confirm('متأكد إنك عايز تسترد الدفعة دي؟ ده هيوقف اشتراك الطالب فورًا.')) return
    setBusyId(id)
    const res = await fetch(`/api/admin/payments/${id}/refund`, { method: 'POST' })
    const result = await res.json()
    alert(result.message || result.error)
    await reload()
    setBusyId(null)
  }

  return (
    <DashboardShell navItems={ADMIN_NAV_ITEMS} userName={adminName || 'أدمن'} roleLabel="حساب أدمن">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">المدفوعات</h1>
        <p className="text-ink/50 text-sm mt-1">
          {data ? `إجمالي الإيرادات: ${data.totalRevenue.toLocaleString()} ج.م` : ''}
        </p>
      </div>

      {loading ? (
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      ) : error || !data ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : data.payments.length === 0 ? (
        <div className="bg-paper border border-ink/10 rounded-2xl p-8 text-center">
          <p className="text-ink/50">مفيش دفعات لسه</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 bg-paper border border-ink/10 rounded-xl px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">
                  {p.students?.full_name || 'طالب محذوف'} — {p.courses?.title || 'كورس محذوف'}
                </p>
                <p className="text-ink/40 text-xs mt-0.5">
                  {p.amount.toLocaleString()} ج.م · {p.provider} · {STATUS_LABELS[p.status] || p.status}
                  {' · '}
                  {new Date(p.created_at).toLocaleDateString('ar-EG')}
                </p>
              </div>
              {p.status === 'success' && (
                <button
                  onClick={() => refundPayment(p.id)}
                  disabled={busyId === p.id}
                  className="text-sm font-bold border border-red-300 text-red-600 hover:bg-red-50 px-3.5 py-1.5 rounded-lg disabled:opacity-50 shrink-0"
                >
                  {busyId === p.id ? 'جاري...' : 'استرداد'}
                </button>
              )}
              {p.status === 'refunded' && (
                <span className="text-ink/40 text-xs shrink-0">تم الاسترداد</span>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  )
}
