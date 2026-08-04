'use client'

import { Suspense } from 'react'
import AuthForm from '@/features/auth/components/AuthForm'

export default function TeacherLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-board" />}>
      <AuthForm fixedRole="teacher" />
    </Suspense>
  )
}
