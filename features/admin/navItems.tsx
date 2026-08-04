import { NavItem } from '@/components/dashboard/DashboardShell'
import { HomeIcon, UserIcon, UsersIcon, TagIcon, ShieldIcon, PackageIcon, WrenchIcon } from '@/components/dashboard/icons'

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/admin/dashboard', label: 'نظرة عامة', icon: <HomeIcon /> },
  { href: '/admin/teachers', label: 'المعلمين', icon: <UserIcon /> },
  { href: '/admin/students', label: 'الطلاب', icon: <UsersIcon /> },
  { href: '/admin/payments', label: 'المدفوعات', icon: <TagIcon /> },
  { href: '/admin/packages', label: 'الباقات', icon: <PackageIcon /> },
  { href: '/admin/admins', label: 'الأدمنز', icon: <ShieldIcon /> },
  { href: '/admin/settings', label: 'الإعدادات', icon: <WrenchIcon /> },
]
