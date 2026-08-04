'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ConversationSummary } from '@/features/chat/types'

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/chat/conversations')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'حصل خطأ في تحميل المحادثات')
      setConversations(data.conversations)
    } catch (err: any) {
      setError(err.message || 'حصل خطأ في تحميل المحادثات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { conversations, loading, error, reload }
}
