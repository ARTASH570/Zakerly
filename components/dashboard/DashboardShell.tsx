'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import GlobalSearch from '@/components/dashboard/GlobalSearch'

export interface NavItem {
  href: string
  label: string
  icon: ReactNode
}

export default function DashboardShell({
  navItems,
  userName,
  roleLabel,
  children,
  searchable = false,
}: {
  navItems: NavItem[]
  userName: string
  roleLabel: string
  children: ReactNode
  /** يفعّل مربع البحث الموحد عن الكورسات والمعلمين في الشريط العلوي (للطالب حاليًا) */
  searchable?: boolean
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-paper text-ink flex" dir="rtl">
      {/* الشريط الجانبي */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-40 w-64 bg-board text-chalk flex flex-col transition-transform duration-300 ease-smooth ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2 px-6 py-6 animate-fade-in-down">
          <div className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center font-display font-bold text-board transition-transform duration-200 hover:scale-110">
            م
          </div>
          <span className="font-display font-bold text-lg">Zakerly</span>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item, i) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ease-smooth animate-slide-in-right ${
                  active
                    ? 'bg-gold text-board font-bold'
                    : 'text-chalk/70 hover:bg-boardLight hover:text-chalk hover:translate-x-[-2px]'
                }`}
              >
                <span className="w-5 h-5 shrink-0 transition-transform duration-200">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-line/60">
          <p className="text-xs text-chalk/50 mb-1">{roleLabel}</p>
          <p className="text-sm font-bold mb-3 truncate">{userName}</p>
          <LogoutButton />
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="إغلاق القايمة"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden animate-fade-in"
        />
      )}

      {/* المحتوى */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between gap-4 px-4 md:px-8 py-4 bg-paper/95 backdrop-blur border-b border-ink/10 sticky top-0 z-20 animate-fade-in-down">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-ink/10 transition-transform duration-200 active:scale-90"
            aria-label="فتح القايمة"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>

          {searchable ? (
            <GlobalSearch />
          ) : (
            <div className="hidden md:flex items-center flex-1 max-w-md bg-ink/5 rounded-xl px-4 py-2.5 gap-2 transition-colors duration-200 focus-within:bg-ink/10">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-ink/40 shrink-0"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m21 21-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <span className="text-sm text-ink/40">دور على أي حاجة...</span>
            </div>
          )}

          <div className="flex items-center gap-3 mr-auto">
            <div className="w-8 h-8 rounded-full bg-board text-chalk flex items-center justify-center text-xs font-bold shrink-0 transition-transform duration-200 hover:scale-110">
              {userName?.trim()?.[0] || 'م'}
            </div>
          </div>
        </header>

        <main key={pathname} className="flex-1 px-4 md:px-8 py-6 max-w-7xl w-full mx-auto animate-fade-in-up">
          {children}
        </main>
      </div>
    </div>
  )
}
