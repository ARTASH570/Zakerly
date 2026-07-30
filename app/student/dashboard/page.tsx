'use client'

import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default function StudentDashboard() {
  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-bold">أهلاً بيك 👋</h1>
        <LogoutButton />
      </div>
      <p className="text-chalk/60 mb-10">
        كورساتك اللي مشترك فيها هتلاقيها هنا.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        <Link href="/student/courses">
          <DashboardCard title="كورساتي" desc="الفيديوهات اللي اشتركت فيها" />
        </Link>
        <Link href="/student/teachers">
          <DashboardCard title="اختار معلم" desc="شوف المعلمين المتاحين واشترك" />
        </Link>
        <Link href="/student/grades">
          <DashboardCard title="درجاتي" desc="متابعة درجاتك وحضورك" />
        </Link>
        <Link href="/student/messages">
          <DashboardCard title="الرسائل" desc="تواصل مباشر مع معلمينك" />
        </Link>
      </div>

      {/* هنا هنبني بعدين: مشغل فيديو Bunny Stream */}
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
