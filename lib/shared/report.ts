interface Evaluation {
  attendance_status: 'present' | 'absent' | null
  grade: number | null
  note: string | null
  evaluated_at: string
}

/**
 * بيحسب ملخص أداء الطالب من كل التقييمات المسجلة له
 */
export function summarizeEvaluations(evaluations: Evaluation[]) {
  const present = evaluations.filter((e) => e.attendance_status === 'present').length
  const absent = evaluations.filter((e) => e.attendance_status === 'absent').length

  const grades = evaluations.filter((e) => e.grade !== null).map((e) => e.grade as number)
  const averageGrade = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null

  const latestNote = evaluations
    .filter((e) => e.note)
    .sort((a, b) => new Date(b.evaluated_at).getTime() - new Date(a.evaluated_at).getTime())[0]
    ?.note

  return { present, absent, averageGrade, latestNote, totalSessions: evaluations.length }
}

/**
 * بيبني نص التقرير اللي هيتبعت لولي الأمر
 */
export function buildParentReportMessage({
  studentName,
  courseTitle,
  teacherName,
  summary,
}: {
  studentName: string
  courseTitle: string
  teacherName: string
  summary: ReturnType<typeof summarizeEvaluations>
}) {
  const lines = [
    `تقرير متابعة الطالب/ة ${studentName}`,
    `الكورس: ${courseTitle} - أ. ${teacherName}`,
    ``,
    `عدد الحصص المسجلة: ${summary.totalSessions}`,
    `الحضور: ${summary.present} | الغياب: ${summary.absent}`,
  ]

  if (summary.averageGrade !== null) {
    lines.push(`متوسط الدرجات: ${summary.averageGrade.toFixed(1)}`)
  }

  if (summary.latestNote) {
    lines.push(``, `آخر ملاحظة من المعلم:`, summary.latestNote)
  }

  return lines.join('\n')
}

/**
 * بيبني رابط واتساب جاهز عشان المعلم يبعت التقرير بضغطة واحدة
 * (بنستخدم واتساب لأنه القناة الأسهل والأسرع مع أولياء الأمور في مصر)
 */
export function buildWhatsAppLink(phone: string, message: string) {
  // بنشيل أي رموز غير أرقام من رقم التليفون، ولو مبدأش بـ 20 (كود مصر) نضيفه
  let cleanPhone = phone.replace(/\D/g, '')
  if (cleanPhone.startsWith('0')) cleanPhone = '2' + cleanPhone
  if (!cleanPhone.startsWith('20')) cleanPhone = '20' + cleanPhone

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}
