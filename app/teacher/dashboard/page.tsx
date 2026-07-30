'use client'

import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default function TeacherDashboard() {
  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-bold">أهلاً بيك 👋</h1>
        <LogoutButton />
      </div>
      <p className="text-chalk/60 mb-10">
        من هنا هتقدر تضيف كورساتك، ترفع الفيديوهات، وتتابع طلابك.
      </p>

      <div className="flex justify-end mb-4">
        <Link href="/teacher/profile" className="text-sm text-chalk/60 hover:text-gold">
          عدّل بياناتك الشخصية →
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Link href="/teacher/courses">
          <DashboardCard title="كورساتي" desc="أضف كورس جديد أو عدّل الموجود" />
        </Link>
        <Link href="/teacher/analytics">
          <DashboardCard title="التحليلات" desc="الإيرادات، الطلاب، ومبيعات الكورسات" />
        </Link>
        <Link href="/teacher/coupons">
          <DashboardCard title="الكوبونات" desc="اعمل أكواد خصم لطلابك" />
        </Link>
        <Link href="/teacher/messages">
          <DashboardCard title="الرسائل" desc="راسل طلابك المشتركين معاك" />
        </Link>
      </div>
    </main>
  )
}

function DashboardCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-boardLight border border-line rounded-xl p-6 hover:border-gold/50 transition-colors cursor-pointer">
      <h3 className="font-display font-bold text-gold mb-2">{title}</h3>
      <p className="text-chalk/60 text-sm">{desc}</p>
    </div>
  )
}
