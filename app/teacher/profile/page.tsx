'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function TeacherProfilePage() {
  const router = useRouter()
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [subject, setSubject] = useState('')
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login?role=teacher')
        return
      }

      const userId = sessionData.session.user.id
      setTeacherId(userId)

      const { data } = await supabase
        .from('teachers')
        .select('full_name, subject, bio, phone')
        .eq('id', userId)
        .single()

      if (data) {
        setFullName(data.full_name || '')
        setSubject(data.subject || '')
        setBio(data.bio || '')
        setPhone(data.phone || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!teacherId) return

    setSaving(true)
    setSavedMsg('')

    try {
      const res = await fetch('/api/teacher/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, subject, bio, phone }),
      })
      const data = await res.json()
      setSavedMsg(res.ok ? 'تم الحفظ ✓' : data.error || 'حصل خطأ، حاول تاني')
    } catch {
      setSavedMsg('حصل خطأ، حاول تاني')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-board text-chalk px-6 py-10 flex items-center justify-center">
        <p className="text-chalk/50">جاري التحميل...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-lg mx-auto">
        <Link href="/teacher/dashboard" className="text-chalk/60 text-sm hover:text-gold">
          ← رجوع للداشبورد
        </Link>

        <h1 className="font-display text-2xl font-bold mt-4 mb-2">بياناتك الشخصية</h1>
        <p className="text-chalk/60 mb-8">
          البيانات دي بتظهر للطلاب لما يدوروا على معلم، خليها واضحة وجاذبة.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-chalk/60 text-sm mb-1 block">الاسم</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full bg-boardLight border border-line rounded-lg px-4 py-3 text-chalk focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-chalk/60 text-sm mb-1 block">المادة اللي بتدرّسها</label>
            <input
              type="text"
              placeholder="مثلاً: فيزياء - ثانوية عامة"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-boardLight border border-line rounded-lg px-4 py-3 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-chalk/60 text-sm mb-1 block">نبذة عنك</label>
            <textarea
              placeholder="خبرتك، أسلوبك في الشرح، أي حاجة تشجع الطالب يختارك"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full bg-boardLight border border-line rounded-lg px-4 py-3 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-chalk/60 text-sm mb-1 block">رقم التليفون (اختياري)</label>
            <input
              type="tel"
              placeholder="01xxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-boardLight border border-line rounded-lg px-4 py-3 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gold text-board font-bold rounded-lg py-3 disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : 'احفظ البيانات'}
          </button>
          {savedMsg && <p className="text-gold text-sm text-center">{savedMsg}</p>}
        </form>
      </div>
    </main>
  )
}
