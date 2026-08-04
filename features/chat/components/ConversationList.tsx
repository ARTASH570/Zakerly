'use client'

import type { ConversationSummary } from '@/features/chat/types'

interface ConversationListProps {
  conversations: ConversationSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  loading,
}: ConversationListProps) {
  if (loading) {
    return <p className="text-chalk/40 text-sm text-center py-6">بتحمّل المحادثات...</p>
  }

  if (conversations.length === 0) {
    return <p className="text-chalk/40 text-sm text-center py-6 px-3">مفيش محادثات لسه</p>
  }

  return (
    <ul className="divide-y divide-line overflow-y-auto h-full">
      {conversations.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => onSelect(c.id)}
            className={`w-full text-right px-4 py-3 hover:bg-boardLight transition-colors ${
              selectedId === c.id ? 'bg-boardLight' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-chalk text-sm">{c.otherPartyName}</span>
              {c.unreadCount > 0 && (
                <span className="bg-gold text-ink text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {c.unreadCount}
                </span>
              )}
            </div>
            {c.courseTitle && <p className="text-chalk/40 text-[11px] mb-1">{c.courseTitle}</p>}
            {c.lastMessagePreview && (
              <p className="text-chalk/60 text-xs truncate">{c.lastMessagePreview}</p>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
