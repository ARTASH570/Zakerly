'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function LogoutButton() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      await supabase.auth.signOut() // بيمسح الجلسة من عميل المتصفح كمان
      window.location.href = '/login'    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-sm text-chalk/60 transition-all duration-200 ease-smooth hover:text-red-400 hover:translate-x-[-2px] active:scale-95 disabled:opacity-60"
    >
      {loading ? 'جاري الخروج...' : 'تسجيل الخروج'}
    </button>
  )
}
