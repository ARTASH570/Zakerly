'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export interface AdminOverview {
  totalTeachers: number
  totalStudents: number
  totalRevenue: number
  teachers: {
    id: string
    full_name: string
    subject: string | null
    is_disabled: boolean
    created_at: string
  }[]
  students: {
    id: string
    full_name: string
    parent_phone: string | null
    is_disabled: boolean
    created_at: string
  }[]
  payments: {
    id: string
    amount: number
    provider: string
    status: string
    created_at: string
    students: { full_name: string } | null
    courses: { title: string } | null
  }[]
  recentActivity: {
    id: string
    user_role: string
    action: string
    entity_type: string | null
    created_at: string
  }[]
}

/**
 * بيحمّل بيانات الأدمن العامة + اسم الأدمن، وبيحوّل لصفحة الدخول لو مش
 * مسجل دخول أو مش أدمن أصلًا. كل صفحات الأدمن بتستخدم نفس الـ hook ده
 * عشان منكررش نفس منطق التحميل والتحقق في كل صفحة لوحدها.
 */
export function useAdminOverview() {
  const router = useRouter()
  const [adminName, setAdminName] = useState('')
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login')
      return
    }

    const { data: adminRow } = await supabase
      .from('admins')
      .select('full_name')
      .eq('id', sessionData.session.user.id)
      .maybeSingle()
    setAdminName(adminRow?.full_name || '')

    const res = await fetch('/api/admin/overview')
    if (res.status === 403 || res.status === 401) {
      setError('مش متاح ليك الوصول للصفحة دي')
      setLoading(false)
      return
    }

    if (res.ok) {
      setData(await res.json())
    } else {
      setError('حصل خطأ في تحميل البيانات')
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  return { adminName, data, loading, error, reload: load }
}
