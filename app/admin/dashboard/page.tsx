'use client'

import DashboardShell from '@/components/dashboard/DashboardShell'
import { StatCard } from '@/components/dashboard/widgets'
import { UsersIcon, UserIcon, TagIcon } from '@/components/dashboard/icons'
import { ADMIN_NAV_ITEMS } from '@/features/admin/navItems'
import { useAdminOverview } from '@/features/admin/useAdminOverview'

const ACTION_LABELS: Record<string, string> = {
  login: 'تسجيل دخول',
  register: 'تسجيل حساب جديد',
  'course.create': 'إضافة كورس',
  'course.update': 'تعديل كورس',
  'video.upload': 'رفع فيديو',
  'enrollment.created': 'اشتراك جديد',
  'payment.success': 'دفعة ناجحة',
  'payment.failure': 'دفعة فاشلة',
  'coupon.create': 'إضافة كوبون',
  'quiz.create': 'إضافة كويز',
  'quiz.publish': 'نشر كويز',
  'quiz.attempt.submit': 'تسليم كويز',
}

const ROLE_LABELS: Record<string, string> = {
  teacher: 'معلم',
  student: 'طالب',
  admin: 'أدمن',
  system: 'النظام',
}

export default function AdminDashboardPage() {
  const { adminName, data, loading, error } = useAdminOverview()

  if (loading) {
    return (
      <DashboardShell navItems={ADMIN_NAV_ITEMS} userName={adminName || 'أدمن'} roleLabel="حساب أدمن">
        <p className="text-ink/50 text-sm">جاري التحميل...</p>
      </DashboardShell>
    )
  }

  if (error || !data) {
    return (
      <DashboardShell navItems={ADMIN_NAV_ITEMS} userName={adminName || 'أدمن'} roleLabel="حساب أدمن">
        <p className="text-red-600 text-sm">{error || 'مش متاح ليك الوصول للصفحة دي'}</p>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell navItems={ADMIN_NAV_ITEMS} userName={adminName || 'أدمن'} roleLabel="حساب أدمن">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">أهلاً بيك، {adminName.split(' ')[0] || 'أدمن'} 👋</h1>
        <p className="text-ink/50 text-sm mt-1">نظرة عامة على المنصة كلها</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="إجمالي المعلمين" value={data.totalTeachers} icon={<UserIcon />} />
        <StatCard label="إجمالي الطلاب" value={data.totalStudents} icon={<UsersIcon />} />
        <StatCard
          label="إجمالي الإيرادات"
          value={`${data.totalRevenue.toLocaleString()} ج.م`}
          icon={<TagIcon />}
        />
      </div>

      <div className="bg-paper border border-ink/10 rounded-2xl p-5">
        <h3 className="font-display font-bold mb-4">آخر الأنشطة في المنصة</h3>
        {data.recentActivity.length === 0 && <p className="text-ink/40 text-sm">مفيش أنشطة لسه</p>}
        <div className="space-y-2">
          {data.recentActivity.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between text-sm border-b border-ink/10 last:border-0 pb-2"
            >
              <span className="text-ink/70">
                <span className="text-gold font-bold">{ROLE_LABELS[a.user_role] || a.user_role}</span>
                {' · '}
                {ACTION_LABELS[a.action] || a.action}
                {a.entity_type ? ` · ${a.entity_type}` : ''}
              </span>
              <span className="text-ink/40 text-xs shrink-0">
                {new Date(a.created_at).toLocaleString('ar-EG')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}
