'use client'

import { Suspense } from 'react'
import AuthForm from '@/features/auth/components/AuthForm'

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-board" />}>
      <AuthForm />
    </Suspense>
  )
}
