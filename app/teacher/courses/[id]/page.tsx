'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import VideoUploader from '@/features/videos/components/VideoUploader'

interface Video {
  id: string
  title: string
  section_id: string | null
}

interface Section {
  id: string
  title: string
  order_index: number
}

export default function ManageCourseVideosPage() {
  const params = useParams()
  const courseId = params.id as string

  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [courseTitle, setCourseTitle] = useState('')
  const [sections, setSections] = useState<Section[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [addingSection, setAddingSection] = useState(false)
  const [uploadingInSection, setUploadingInSection] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  // بنستخدم drag & drop الأصلي في HTML - من غير أي مكتبة خارجية
  const dragInfoRef = useRef<{ videoId: string; sectionId: string } | null>(null)

  const loadData = useCallback(async () => {
    const { data: sectionsData } = await supabase
      .from('sections')
      .select('id, title, order_index')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })

    const { data: videosData } = await supabase
      .from('videos')
      .select('id, title, section_id')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })

    setSections(sectionsData || [])
    setVideos(videosData || [])
  }, [courseId])

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) setTeacherId(userData.user.id)

      const { data: course } = await supabase
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .single()

      if (course) setCourseTitle(course.title)
      await loadData()
    }
    load()
  }, [courseId, loadData])

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault()
    if (!newSectionTitle.trim()) return

    setAddingSection(true)
    try {
      const res = await fetch('/api/sections/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, title: newSectionTitle }),
      })
      if (res.ok) {
        setNewSectionTitle('')
        await loadData()
      }
    } finally {
      setAddingSection(false)
    }
  }

  function videosInSection(sectionId: string) {
    return videos.filter((v) => v.section_id === sectionId)
  }

  function handleDragStart(videoId: string, sectionId: string) {
    dragInfoRef.current = { videoId, sectionId }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function handleDrop(targetSectionId: string, targetIndex: number) {
    const dragInfo = dragInfoRef.current
    dragInfoRef.current = null
    // بسّطنا الميزة عشان تشتغل جوه نفس القسم بس دلوقتي (مش نقل بين قسمين مختلفين)
    if (!dragInfo || dragInfo.sectionId !== targetSectionId) return

    const sectionVideos = videosInSection(targetSectionId)
    const dragIndex = sectionVideos.findIndex((v) => v.id === dragInfo.videoId)
    if (dragIndex === -1 || dragIndex === targetIndex) return

    const reordered = [...sectionVideos]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    // نحدّث الترتيب محليًا فورًا عشان الاستجابة تكون سريعة
    const otherVideos = videos.filter((v) => v.section_id !== targetSectionId)
    setVideos([...otherVideos, ...reordered])

    setSavingOrder(true)
    try {
      await fetch('/api/videos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, orderedVideoIds: reordered.map((v) => v.id) }),
      })
    } finally {
      setSavingOrder(false)
    }
  }

  async function handleDuplicateVideo(videoId: string) {
    setDuplicatingId(videoId)
    try {
      const res = await fetch(`/api/videos/${videoId}/duplicate`, { method: 'POST' })
      if (res.ok) await loadData()
    } finally {
      setDuplicatingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/teacher/courses" className="text-chalk/60 text-sm hover:text-gold">
          ← رجوع لكورساتي
        </Link>

        <div className="flex items-center justify-between mt-4 mb-2">
          <h1 className="font-display text-2xl font-bold">{courseTitle}</h1>
          <Link
            href={`/teacher/courses/${courseId}/students`}
            className="text-sm border border-line rounded-lg px-4 py-2 hover:border-gold hover:text-gold transition-colors"
          >
            متابعة الطلاب والتقارير
          </Link>
        </div>
        {savingOrder && <p className="text-chalk/40 text-xs mb-4">جاري حفظ الترتيب...</p>}

        {/* إضافة قسم جديد */}
        <form onSubmit={handleAddSection} className="flex gap-2 mb-8 mt-6">
          <input
            type="text"
            placeholder="اسم قسم جديد (مثلاً: الوحدة الأولى)"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            className="flex-1 bg-boardLight border border-line rounded-lg px-4 py-2 text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold text-sm"
          />
          <button
            type="submit"
            disabled={addingSection}
            className="bg-gold text-board font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            {addingSection ? '...' : '+ قسم'}
          </button>
        </form>

        {sections.length === 0 && (
          <p className="text-chalk/50 text-sm mb-6">
            ابدأ بإضافة قسم (زي "الوحدة الأولى") قبل ما ترفع فيديوهات.
          </p>
        )}

        <div className="space-y-6">
          {sections.map((section) => {
            const sectionVideos = videosInSection(section.id)
            return (
              <div key={section.id} className="border border-line rounded-xl overflow-hidden">
                <div className="bg-boardLight px-5 py-3 border-b border-line">
                  <h3 className="font-display font-bold text-gold">{section.title}</h3>
                </div>

                <div className="p-4 space-y-2 bg-board">
                  {sectionVideos.length === 0 && (
                    <p className="text-chalk/40 text-xs px-1">لسه مفيش فيديوهات في القسم ده</p>
                  )}
                  {sectionVideos.map((video, index) => (
                    <div
                      key={video.id}
                      draggable
                      onDragStart={() => handleDragStart(video.id, section.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(section.id, index)}
                      className="flex items-center gap-3 bg-boardLight border border-line rounded-lg px-4 py-3 cursor-move hover:border-gold/40 transition-colors"
                    >
                      <span className="text-chalk/30 select-none">⠿</span>
                      <span className="text-gold font-bold text-sm">{index + 1}</span>
                      <p className="text-chalk flex-1 text-sm">{video.title}</p>
                      <button
                        onClick={() => handleDuplicateVideo(video.id)}
                        disabled={duplicatingId === video.id}
                        className="text-chalk/50 text-xs hover:text-gold disabled:opacity-50"
                      >
                        {duplicatingId === video.id ? 'جاري النسخ...' : 'كرر'}
                      </button>
                    </div>
                  ))}

                  {teacherId && uploadingInSection === section.id ? (
                    <VideoUploader
                      courseId={courseId}
                      sectionId={section.id}
                      onUploaded={loadData}
                    />
                  ) : (
                    <button
                      onClick={() => setUploadingInSection(section.id)}
                      className="w-full text-center border border-dashed border-line rounded-lg py-2 text-chalk/50 text-sm hover:border-gold hover:text-gold transition-colors"
                    >
                      + ارفع فيديو في القسم ده
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
