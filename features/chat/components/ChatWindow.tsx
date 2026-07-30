'use client'

import { useEffect, useRef, useState } from 'react'
import { useChatMessages } from '@/features/chat/hooks/useChatMessages'

interface ChatWindowProps {
  conversationId: string | null
  currentUserId: string
  otherPartyName: string
}

export default function ChatWindow({ conversationId, currentUserId, otherPartyName }: ChatWindowProps) {
  const { messages, loading, error, sending, sendMessage } = useChatMessages(conversationId)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    try {
      await sendMessage(text)
    } catch {
      setDraft(text) // نرجّع النص لو فشل الإرسال عشان المستخدم يحاول تاني
    }
  }

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-chalk/40">
        اختار محادثة من القايمة عشان تبدأ
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display font-bold text-chalk">{otherPartyName}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && <p className="text-chalk/40 text-sm text-center">بتحمّل الرسائل...</p>}
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {!loading && messages.length === 0 && (
          <p className="text-chalk/40 text-sm text-center">لسه مفيش رسائل، ابدأ المحادثة 👋</p>
        )}

        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[75%] rounded-xl px-4 py-2 text-sm ${
                  isMine ? 'bg-gold text-ink' : 'bg-boardLight text-chalk border border-line'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                <span className={`block text-[10px] mt-1 ${isMine ? 'text-ink/60' : 'text-chalk/40'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-line p-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="اكتب رسالتك..."
          maxLength={2000}
          className="flex-1 bg-boardLight border border-line rounded-lg px-4 py-2 text-chalk placeholder:text-chalk/30 focus:outline-none focus:border-gold/50"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="bg-gold text-ink font-bold px-5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold/90 transition-colors"
        >
          إرسال
        </button>
      </form>
    </div>
  )
}
