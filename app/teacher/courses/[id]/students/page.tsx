'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { summarizeEvaluations, buildParentReportMessage, buildWhatsAppLink } from '@/lib/shared/report'

interface StudentRow {
  student_id: string
  full_name: string
  parent_phone: string | null
}

export default function CourseStudentsPage() {
  const params = useParams()
  const courseId = params.id as string

  const [courseTitle, setCourseTitle] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)

  // حالة الفورم المفتوح حاليًا (طالب واحد بس بيتفتح في المرة)
  const [openStudentId, setOpenStudentId] = useState<string | null>(null)
  const [attendance, setAttendance] = useState<'present' | 'absent'>('present')
  const [grade, setGrade] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const loadStudents = useCallback(async () => {
    const { data: course } = await supabase
      .from('courses')
      .select('title, teachers(full_name)')
      .eq('id', courseId)
      .single()

    if (course) {
      setCourseTitle(course.title)
      setTeacherName((course as any).teachers?.full_name || '')
    }

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, students(full_name, parent_phone)')
      .eq('course_id', courseId)
      .eq('is_active', true)

    const rows = (enrollments || []).map((e: any) => ({
      student_id: e.student_id,
      full_name: e.students?.full_name,
      parent_phone: e.students?.parent_phone,
    }))

    setStudents(rows)
    setLoading(false)
  }, [courseId])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  function openForm(studentId: string) {
    setOpenStudentId(studentId)
    setAttendance('present')
    setGrade('')
    setNote('')
    setSavedMsg('')
  }

  async function handleSaveEvaluation(studentId: string) {
    setSaving(true)
    const { error } = await supabase.from('student_evaluations').insert({
      student_id: studentId,
      course_id: courseId,
      attendance_status: attendance,
      grade: grade ? Number(grade) : null,
      note: note || null,
    })

    if (!error) {
      setSavedMsg('تم الحفظ ✓')
    }
    setSaving(false)
  }

  async function handleSendReport(student: StudentRow) {
    const { data: evaluations } = await supabase
      .from('student_evaluations')
      .select('attendance_status, grade, note, evaluated_at')
      .eq('student_id', student.student_id)
      .eq('course_id', courseId)

    const summary = summarizeEvaluations(evaluations || [])
    const message = buildParentReportMessage({
      studentName: student.full_name,
      courseTitle,
      teacherName,
      summary,
    })

    if (!student.parent_phone) {
      alert('مفيش رقم لولي الأمر مسجل لهذا الطالب')
      return
    }

    const link = buildWhatsAppLink(student.parent_phone, message)
    window.open(link, '_blank')
  }

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href={`/teacher/courses/${courseId}`} className="text-chalk/60 text-sm hover:text-gold">
          ← رجوع لإدارة الكورس
        </Link>

        <h1 className="font-display text-2xl font-bold mt-4 mb-1">طلاب {courseTitle}</h1>
        <p className="text-chalk/60 mb-8">{students.length} طالب مشترك</p>

        {loading && <p className="text-chalk/50">جاري التحميل...</p>}

        <div className="space-y-3">
          {students.map((student) => (
            <div
              key={student.student_id}
              className="bg-boardLight border border-line rounded-xl p-5"
            >
              <div className="flex items-center justify-between">
                <p className="font-bold">{student.full_name}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSendReport(student)}
                    className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-gold hover:text-gold transition-colors"
                  >
                    ابعت تقرير لولي الأمر
                  </button>
                  <button
                    onClick={() =>
                      openStudentId === student.student_id
                        ? setOpenStudentId(null)
                        : openForm(student.student_id)
                    }
                    className="text-sm bg-gold text-board font-bold rounded-lg px-3 py-1.5"
                  >
                    {openStudentId === student.student_id ? 'إغلاق' : 'سجّل حصة'}
                  </button>
                </div>
              </div>

              {openStudentId === student.student_id && (
                <div className="mt-4 pt-4 border-t border-line space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAttendance('present')}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold ${
                        attendance === 'present' ? 'bg-gold text-board' : 'bg-board text-chalk/60'
                      }`}
                    >
                      حاضر
                    </button>
                    <button
                      onClick={() => setAttendance('absent')}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold ${
                        attendance === 'absent' ? 'bg-red-400 text-board' : 'bg-board text-chalk/60'
                      }`}
                    >
                      غايب
                    </button>
                  </div>

                  <input
                    type="number"
                    placeholder="الدرجة (اختياري)"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full bg-board border border-line rounded-lg px-4 py-2 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
                  />

                  <textarea
                    placeholder="ملاحظة (اختياري)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full bg-board border border-line rounded-lg px-4 py-2 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
                  />

                  <button
                    onClick={() => handleSaveEvaluation(student.student_id)}
                    disabled={saving}
                    className="w-full bg-gold text-board font-bold rounded-lg py-2 disabled:opacity-50"
                  >
                    {saving ? 'جاري الحفظ...' : 'احفظ'}
                  </button>
                  {savedMsg && <p className="text-gold text-sm text-center">{savedMsg}</p>}
                </div>
              )}
            </div>
          ))}

          {!loading && students.length === 0 && (
            <p className="text-chalk/50 text-sm">لسه مفيش طلاب مشتركين في الكورس ده</p>
          )}
        </div>
      </div>
    </main>
  )
}
