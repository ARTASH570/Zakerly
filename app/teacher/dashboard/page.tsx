'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import DashboardShell, { NavItem } from '@/components/dashboard/DashboardShell'
import ProgressRing from '@/components/dashboard/ProgressRing'
import { StatCard, MiniCalendar } from '@/components/dashboard/widgets'
import { HomeIcon, BookIcon, ChartIcon, TagIcon, ChatIcon, UserIcon, AwardIcon, UsersIcon, PackageIcon } from '@/components/dashboard/icons'

const NAV_ITEMS: NavItem[] = [
  { href: '/teacher/dashboard', label: 'الرئيسية', icon: <HomeIcon /> },
  { href: '/teacher/courses', label: 'كورساتي', icon: <BookIcon /> },
  { href: '/teacher/quizzes', label: 'الكويزات', icon: <AwardIcon /> },
  { href: '/teacher/analytics', label: 'التحليلات', icon: <ChartIcon /> },
  { href: '/teacher/coupons', label: 'الكوبونات', icon: <TagIcon /> },
  { href: '/teacher/packages', label: 'الباقات', icon: <PackageIcon /> },
  { href: '/teacher/messages', label: 'الرسائل', icon: <ChatIcon /> },
  { href: '/teacher/profile', label: 'بياناتي', icon: <UserIcon /> },
]

interface DashboardStats {
  totalStudents: number
  activeStudents: number
  totalRevenue: number
  monthlyRevenue: { month: string; revenue: number }[]
  courseSales: { title: string; sales: number }[]
  recentActivity: { id: string; action: string; entity_type: string | null; created_at: string }[]
  totalWatchTimeHours: number
}

const ACTION_LABELS: Record<string, string> = {
  create: 'إضافة',
  update: 'تعديل',
  delete: 'حذف',
  publish: 'نشر',
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [teacherName, setTeacherName] = useState('')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/login/teacher')
      return
    }

    const { data: teacherRow } = await supabase
      .from('teachers')
      .select('full_name')
      .eq('id', userData.user.id)
      .single()
    setTeacherName(teacherRow?.full_name || '')

    const res = await fetch('/api/teacher/dashboard/stats')
    if (res.ok) {
      setStats(await res.json())
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const maxSales = stats?.courseSales.length
    ? Math.max(...stats.courseSales.map((c) => c.sales), 1)
    : 1

  const retentionPercent =
    stats && stats.totalStudents > 0
      ? Math.round((stats.activeStudents / stats.totalStudents) * 100)
      : 0

  return (
    <DashboardShell navItems={NAV_ITEMS} userName={teacherName || 'معلم'} roleLabel="حساب معلم">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold">أهلاً بيك، {teacherName.split(' ')[0] || ''} 👋</h1>
          <p className="text-ink/50 text-sm mt-1">من هنا هتقدر تتابع طلابك، كورساتك، وإيراداتك</p>
        </div>
        <Link href="/teacher/profile" className="hidden sm:block text-sm text-ink/50 hover:text-gold">
          عدّل بياناتك الشخصية →
        </Link>
      </div>

      {loading || !stats ? (
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      ) : (
        <>
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-board text-chalk rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex-1 text-center sm:text-right">
                <h2 className="font-display text-lg font-bold mb-2">
                  عندك {stats.totalStudents} طالب على {stats.courseSales.length} كورس
                </h2>
                <p className="text-chalk/60 text-sm mb-4">
                  إجمالي الإيرادات: {stats.totalRevenue.toLocaleString()} ج.م
                </p>
                <Link
                  href="/teacher/courses"
                  className="inline-block bg-gold text-board font-bold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                >
                  إدارة الكورسات
                </Link>
              </div>
              <div className="flex gap-4 shrink-0">
                <ProgressRing percent={retentionPercent} label="طلاب نشطين" />
                <ProgressRing
                  percent={100}
                  value={stats.totalWatchTimeHours}
                  label="ساعات مشاهدة"
                  color="#7C9885"
                />
              </div>
            </div>

            <MiniCalendar />
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <StatCard label="إجمالي الطلاب" value={stats.totalStudents} icon={<UsersIcon />} />
            <StatCard label="طلاب نشطين" value={stats.activeStudents} icon={<UserIcon />} />
            <StatCard
              label="إجمالي الإيرادات"
              value={`${stats.totalRevenue.toLocaleString()} ج.م`}
              icon={<TagIcon />}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-paper border border-ink/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold">الإيراد الشهري (آخر 6 شهور)</h3>
                <Link href="/teacher/analytics" className="text-gold text-sm hover:underline">
                  التحليلات كاملة
                </Link>
              </div>
              <div className="flex items-end gap-3 h-40">
                {stats.monthlyRevenue.map((m) => {
                  const max = Math.max(...stats.monthlyRevenue.map((x) => x.revenue), 1)
                  const heightPct = Math.max((m.revenue / max) * 100, 3)
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[11px] text-ink/50">
                        {m.revenue > 0 ? m.revenue.toLocaleString() : ''}
                      </span>
                      <div
                        className="w-full max-w-[36px] rounded-t-md bg-gold/80"
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[11px] text-ink/40 whitespace-nowrap">{m.month}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-paper border border-ink/10 rounded-2xl p-5">
              <h3 className="font-display font-bold mb-4">أفضل الكورسات مبيعًا</h3>
              {stats.courseSales.length === 0 && (
                <p className="text-ink/40 text-sm">لسه معملتش كورس</p>
              )}
              <div className="space-y-3">
                {stats.courseSales
                  .slice()
                  .sort((a, b) => b.sales - a.sales)
                  .slice(0, 5)
                  .map((c) => (
                    <div key={c.title}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="truncate font-bold">{c.title}</span>
                        <span className="text-ink/50 shrink-0">{c.sales}</span>
                      </div>
                      <div className="w-full bg-ink/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gold h-full"
                          style={{ width: `${(c.sales / maxSales) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="bg-paper border border-ink/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold">آخر الأنشطة</h3>
            </div>
            {stats.recentActivity.length === 0 && (
              <p className="text-ink/40 text-sm">مفيش أنشطة لسه</p>
            )}
            <div className="space-y-2">
              {stats.recentActivity.slice(0, 6).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between text-sm border-b border-ink/10 last:border-0 pb-2"
                >
                  <span className="text-ink/70">
                    {ACTION_LABELS[a.action] || a.action}
                    {a.entity_type ? ` · ${a.entity_type}` : ''}
                  </span>
                  <span className="text-ink/40 text-xs shrink-0">
                    {new Date(a.created_at).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  )
}
