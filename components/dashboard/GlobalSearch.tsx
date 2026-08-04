'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

interface CourseResult {
  id: string
  title: string
}

interface TeacherResult {
  id: string
  full_name: string
  subject: string | null
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState<CourseResult[]>([])
  const [teachers, setTeachers] = useState<TeacherResult[]>([])
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setCourses([])
      setTeachers([])
      return
    }

    setLoading(true)
    const timeout = setTimeout(async () => {
      // البحث بيعتمد على نفس البيانات العامة المسموح الجميع يشوفها (الكورسات
      // المنشورة، وview بيانات المعلمين الآمنة) - نفس مصادر صفحة "اختار معلم"
      const [{ data: courseRows }, { data: teacherRows }] = await Promise.all([
        supabase
          .from('courses')
          .select('id, title')
          .eq('is_published', true)
          .ilike('title', `%${term}%`)
          .limit(5),
        supabase
          .from('public_teacher_profiles')
          .select('id, full_name, subject')
          .or(`full_name.ilike.%${term}%,subject.ilike.%${term}%`)
          .limit(5),
      ])
      setCourses(courseRows || [])
      setTeachers(teacherRows || [])
      setLoading(false)
    }, 300)

    return () => clearTimeout(timeout)
  }, [query])

  const hasResults = courses.length > 0 || teachers.length > 0

  return (
    <div ref={boxRef} className="relative hidden md:block flex-1 max-w-md">
      <div className="flex items-center bg-ink/5 rounded-xl px-4 py-2.5 gap-2 transition-colors duration-200 focus-within:bg-ink/10">
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-ink/40 shrink-0">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m21 21-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="دور عن كورس أو معلم..."
          className="bg-transparent text-sm w-full outline-none placeholder:text-ink/40"
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute top-full mt-2 w-full bg-paper border border-ink/10 rounded-xl shadow-lg overflow-hidden z-30 animate-scale-in origin-top">
          {loading && <p className="text-ink/40 text-xs px-4 py-3">جاري البحث...</p>}

          {!loading && !hasResults && (
            <p className="text-ink/40 text-xs px-4 py-3">مفيش نتايج مطابقة</p>
          )}

          {!loading && teachers.length > 0 && (
            <div className="py-1.5">
              <p className="text-ink/40 text-[11px] font-bold px-4 pb-1">المعلمين</p>
              {teachers.map((t) => (
                <Link
                  key={t.id}
                  href="/student/teachers"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm transition-colors duration-150 hover:bg-ink/5"
                >
                  {t.full_name} {t.subject && <span className="text-ink/40 text-xs">· {t.subject}</span>}
                </Link>
              ))}
            </div>
          )}

          {!loading && courses.length > 0 && (
            <div className="py-1.5 border-t border-ink/10">
              <p className="text-ink/40 text-[11px] font-bold px-4 pb-1">الكورسات</p>
              {courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/student/courses/${c.id}`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm transition-colors duration-150 hover:bg-ink/5"
                >
                  {c.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
