'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { ChatMessage } from '@/features/chat/types'

interface UseChatMessagesResult {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  sending: boolean
  sendMessage: (body: string) => Promise<void>
}

/**
 * بيحمّل تاريخ الرسائل لمحادثة معينة، وبيفتح اشتراك Realtime عشان أي رسالة
 * جديدة توصل فورًا من غير ما نحتاج نعمل تحديث للصفحة أو Polling.
 *
 * ⚠️ عشان الـ Realtime يشتغل، لازم جدول chat_messages يكون متفعّل في
 * Supabase Dashboard > Database > Replication (زي ما موضح في supabase/chat_schema.sql)
 */
export function useChatMessages(conversationId: string | null): UseChatMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const seenIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }

    let cancelled = false
    seenIds.current = new Set()
    setLoading(true)
    setError(null)

    async function loadHistory() {
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}/messages`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'حصل خطأ في تحميل الرسائل')
        if (cancelled) return
        const history: ChatMessage[] = data.messages
        history.forEach((m) => seenIds.current.add(m.id))
        setMessages(history)

        // نعلّم رسايل الطرف التاني كمقروءة أول ما نفتح المحادثة
        fetch(`/api/chat/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => {})
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'حصل خطأ في تحميل الرسائل')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadHistory()

    const channel = supabase
      .channel(`chat_messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessage
          if (seenIds.current.has(incoming.id)) return
          seenIds.current.add(incoming.id)
          setMessages((prev) => [...prev, incoming])
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  const sendMessage = useCallback(
    async (body: string) => {
      if (!conversationId || !body.trim()) return
      setSending(true)
      setError(null)
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'حصل خطأ في إرسال الرسالة')

        // نضيفها محليًا فورًا (الاشتراك هيتجاهلها لو وصلت تاني بفضل seenIds)
        if (data.message && !seenIds.current.has(data.message.id)) {
          seenIds.current.add(data.message.id)
          setMessages((prev) => [...prev, data.message])
        }
      } catch (err: any) {
        setError(err.message || 'حصل خطأ في إرسال الرسالة')
        throw err
      } finally {
        setSending(false)
      }
    },
    [conversationId]
  )

  return { messages, loading, error, sending, sendMessage }
}
