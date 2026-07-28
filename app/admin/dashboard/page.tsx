'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

interface Teacher {
  id: string
  full_name: string
  subject: string | null
  is_disabled: boolean
  created_at: string
}

interface Student {
  id: string
  full_name: string
  parent_phone: string | null
  is_disabled: boolean
  created_at: string
}

interface Payment {
  id: string
  amount: number
  provider: string
  status: string
  created_at: string
  students: { full_name: string } | null
  courses: { title: string } | null
}

interface Activity {
  id: string
  user_role: string
  action: string
  entity_type: string | null
  created_at: string
}

interface Overview {
  totalTeachers: number
  totalStudents: number
  totalRevenue: number
  teachers: Teacher[]
  students: Student[]
  payments: Payment[]
  recentActivity: Activity[]
}

const TABS = ['نظرة عامة', 'المعلمين', 'الطلاب', 'المدفوعات'] as const
type Tab = (typeof TABS)[number]

export default function AdminDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('نظرة عامة')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login')
      return
    }

    const res = await fetch('/api/admin/overview')
    if (res.status === 403 || res.status === 401) {
      router.push('/login')
      return
    }

    if (res.ok) {
      setData(await res.json())
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function toggleTeacher(id: string) {
    setBusyId(id)
    await fetch(`/api/admin/teachers/${id}/toggle-disable`, { method: 'POST' })
    await load()
    setBusyId(null)
  }

  async function toggleStudent(id: string) {
    setBusyId(id)
    await fetch(`/api/admin/students/${id}/toggle-disable`, { method: 'POST' })
    await load()
    setBusyId(null)
  }

  async function refundPayment(id: string) {
    if (!confirm('متأكد إنك عايز تسترد الدفعة دي؟ ده هيوقف اشتراك الطالب فورًا.')) return
    setBusyId(id)
    const res = await fetch(`/api/admin/payments/${id}/refund`, { method: 'POST' })
    const result = await res.json()
    alert(result.message || result.error)
    await load()
    setBusyId(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-board text-chalk px-6 py-10 flex items-center justify-center">
        <p className="text-chalk/50">جاري التحميل...</p>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-board text-chalk px-6 py-10 flex items-center justify-center">
        <p className="text-chalk/50">مش متاح ليك الوصول للصفحة دي</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-2xl font-bold mb-8">لوحة تحكم الأدمن</h1>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="المعلمين" value={data.totalTeachers} />
          <StatCard label="الطلاب" value={data.totalStudents} />
          <StatCard label="الإيراد الكلي" value={`${data.totalRevenue.toLocaleString()} ج.م`} />
        </div>

        <div className="flex gap-2 mb-6 border-b border-line overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm whitespace-nowrap ${
                tab === t ? 'text-gold border-b-2 border-gold' : 'text-chalk/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'نظرة عامة' && (
          <div className="bg-boardLight border border-line rounded-xl p-6">
            <h3 className="font-display font-bold mb-4">آخر الأنشطة</h3>
            <div className="space-y-2">
              {data.recentActivity.map((a) => (
                <div key={a.id} className="flex justify-between text-sm border-b border-line/50 pb-2">
                  <span className="text-chalk/80">
                    {a.user_role} · {a.action}
                  </span>
                  <span className="text-chalk/40 text-xs">
                    {new Date(a.created_at).toLocaleString('ar-EG')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'المعلمين' && (
          <div className="space-y-2">
            {data.teachers.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-boardLight border border-line rounded-lg px-4 py-3"
              >
                <div>
                  <p className="font-bold">{t.full_name}</p>
                  <p className="text-chalk/50 text-xs">{t.subject || '-'}</p>
                </div>
                <button
                  onClick={() => toggleTeacher(t.id)}
                  disabled={busyId === t.id}
                  className={`text-sm px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                    t.is_disabled ? 'bg-gold text-board' : 'border border-red-400 text-red-400'
                  }`}
                >
                  {t.is_disabled ? 'إعادة تفعيل' : 'تعطيل'}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'الطلاب' && (
          <div className="space-y-2">
            {data.students.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between bg-boardLight border border-line rounded-lg px-4 py-3"
              >
                <div>
                  <p className="font-bold">{s.full_name}</p>
                  <p className="text-chalk/50 text-xs">{s.parent_phone || '-'}</p>
                </div>
                <button
                  onClick={() => toggleStudent(s.id)}
                  disabled={busyId === s.id}
                  className={`text-sm px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                    s.is_disabled ? 'bg-gold text-board' : 'border border-red-400 text-red-400'
                  }`}
                >
                  {s.is_disabled ? 'إعادة تفعيل' : 'تعطيل'}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'المدفوعات' && (
          <div className="space-y-2">
            {data.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-boardLight border border-line rounded-lg px-4 py-3"
              >
                <div>
                  <p className="font-bold">
                    {p.students?.full_name} — {p.courses?.title}
                  </p>
                  <p className="text-chalk/50 text-xs">
                    {p.amount} ج.م · {p.provider} · {p.status}
                  </p>
                </div>
                {p.status === 'success' && (
                  <button
                    onClick={() => refundPayment(p.id)}
                    disabled={busyId === p.id}
                    className="text-sm border border-red-400 text-red-400 px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {busyId === p.id ? 'جاري...' : 'استرداد'}
                  </button>
                )}
                {p.status === 'refunded' && <span className="text-chalk/40 text-xs">مستردة</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-boardLight border border-line rounded-xl p-4">
      <p className="text-chalk/50 text-xs mb-1">{label}</p>
      <p className="text-gold font-display font-bold text-xl">{value}</p>
    </div>
  )
}
