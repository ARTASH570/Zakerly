'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

interface DashboardStats {
  totalStudents: number
  activeStudents: number
  totalRevenue: number
  monthlyRevenue: { month: string; revenue: number }[]
  courseSales: { title: string; sales: number }[]
  mostWatchedVideos: { title: string; views: number; completionRate: number }[]
  totalWatchTimeHours: number
  recentActivity: {
    id: string
    action: string
    entity_type: string | null
    metadata: Record<string, unknown>
    created_at: string
  }[]
}

const ACTION_LABELS: Record<string, string> = {
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  register: 'إنشاء حساب',
  'password.reset': 'تغيير كلمة السر',
  'course.create': 'إنشاء كورس',
  'video.upload': 'رفع فيديو',
  'payment.success': 'دفعة ناجحة',
  'payment.failure': 'دفعة فاشلة',
  'enrollment.created': 'اشتراك جديد',
  'settings.update': 'تعديل الإعدادات',
  'coupon.create': 'إنشاء كوبون',
  'coupon.usage': 'استخدام كوبون',
}

export default function TeacherAnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/teacher/dashboard/stats')
      if (res.ok) {
        setStats(await res.json())
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-board text-chalk px-6 py-10 flex items-center justify-center">
        <p className="text-chalk/50">جاري تحميل الإحصائيات...</p>
      </main>
    )
  }

  if (!stats) {
    return (
      <main className="min-h-screen bg-board text-chalk px-6 py-10 flex items-center justify-center">
        <p className="text-chalk/50">حصل خطأ في تحميل الإحصائيات</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl font-bold">التحليلات</h1>
          <Link href="/teacher/dashboard" className="text-chalk/60 text-sm hover:text-gold">
            رجوع للداشبورد
          </Link>
        </div>

        {/* البطاقات الأساسية */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="إجمالي الطلاب" value={stats.totalStudents} />
          <StatCard label="طلاب نشطين" value={stats.activeStudents} />
          <StatCard label="إجمالي الإيراد" value={`${stats.totalRevenue.toLocaleString()} ج.م`} />
          <StatCard label="ساعات المشاهدة" value={`${stats.totalWatchTimeHours} ساعة`} />
        </div>

        {/* الإيراد الشهري */}
        <div className="bg-boardLight border border-line rounded-xl p-6 mb-6">
          <h3 className="font-display font-bold mb-4">الإيراد آخر 6 شهور</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3A4E45" />
              <XAxis dataKey="month" stroke="#F1EDE2" fontSize={12} />
              <YAxis stroke="#F1EDE2" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#24392F', border: '1px solid #3A4E45' }}
                labelStyle={{ color: '#F1EDE2' }}
              />
              <Line type="monotone" dataKey="revenue" stroke="#D9A441" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* مبيعات الكورسات */}
        <div className="bg-boardLight border border-line rounded-xl p-6 mb-6">
          <h3 className="font-display font-bold mb-4">مبيعات كل كورس</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.courseSales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3A4E45" />
              <XAxis dataKey="title" stroke="#F1EDE2" fontSize={11} />
              <YAxis stroke="#F1EDE2" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#24392F', border: '1px solid #3A4E45' }}
                labelStyle={{ color: '#F1EDE2' }}
              />
              <Bar dataKey="sales" fill="#D9A441" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* الفيديوهات الأكتر مشاهدة + نسبة الإكمال */}
        <div className="bg-boardLight border border-line rounded-xl p-6 mb-6">
          <h3 className="font-display font-bold mb-4">الفيديوهات الأكتر مشاهدة</h3>
          <div className="space-y-3">
            {stats.mostWatchedVideos.length === 0 && (
              <p className="text-chalk/50 text-sm">مفيش بيانات مشاهدة كفاية لسه</p>
            )}
            {stats.mostWatchedVideos.map((video) => (
              <div key={video.title} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-chalk/90 text-sm">{video.title}</p>
                  <div className="w-full bg-board rounded-full h-1.5 mt-1 overflow-hidden">
                    <div
                      className="bg-gold h-full"
                      style={{ width: `${video.completionRate}%` }}
                    />
                  </div>
                </div>
                <div className="text-left mr-4 whitespace-nowrap">
                  <p className="text-gold text-sm font-bold">{video.views} مشاهدة</p>
                  <p className="text-chalk/40 text-xs">{video.completionRate}% إكمال</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* آخر الأنشطة */}
        <div className="bg-boardLight border border-line rounded-xl p-6">
          <h3 className="font-display font-bold mb-4">آخر الأنشطة</h3>
          <div className="space-y-2">
            {stats.recentActivity.length === 0 && (
              <p className="text-chalk/50 text-sm">مفيش نشاط مسجل لسه</p>
            )}
            {stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between border-b border-line/50 pb-2 last:border-0"
              >
                <span className="text-chalk/80 text-sm">
                  {ACTION_LABELS[activity.action] || activity.action}
                </span>
                <span className="text-chalk/40 text-xs">
                  {new Date(activity.created_at).toLocaleString('ar-EG', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
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
