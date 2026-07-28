'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import VideoPlayer from '@/components/VideoPlayer'

interface Video {
  id: string
  title: string
  section_id: string | null
}

interface Section {
  id: string
  title: string
}

interface ViewProgress {
  video_id: string
  completed: boolean
  max_position_seconds: number
  duration_seconds: number | null
}

function WatchCourseContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const courseId = params.id as string
  const requestedVideoId = searchParams.get('videoId')

  const [courseTitle, setCourseTitle] = useState('')
  const [sections, setSections] = useState<Section[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [viewsByVideoId, setViewsByVideoId] = useState<Record<string, ViewProgress>>({})
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login?role=student')
        return
      }

      // تأكد إن الطالب مشترك (الـ RLS أصلاً بيمنعه يشوف فيديوهات مش مشترك فيها،
      // فلو رجعت فاضية يبقى مش مشترك)
      const { data: courseData } = await supabase
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .single()

      if (courseData) setCourseTitle(courseData.title)

      const { data: sectionsData } = await supabase
        .from('sections')
        .select('id, title')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      const { data: videoData } = await supabase
        .from('videos')
        .select('id, title, section_id')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      if (!videoData || videoData.length === 0) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      setSections(sectionsData || [])
      setVideos(videoData)

      // تقدم الطالب في كل فيديو من فيديوهات الكورس ده - عشان نعرض علامة "مكتمل" وشريط تقدم
      const { data: views } = await supabase
        .from('video_views')
        .select('video_id, completed, max_position_seconds, duration_seconds')
        .eq('student_id', userData.user.id)
        .eq('course_id', courseId)

      const map: Record<string, ViewProgress> = {}
      for (const v of views || []) map[v.video_id] = v
      setViewsByVideoId(map)

      // لو جاي من "استكمال المشاهدة" بفيديو محدد، افتحه على طول، وإلا افتح الأول
      const initialVideo =
        requestedVideoId && videoData.some((v) => v.id === requestedVideoId)
          ? requestedVideoId
          : videoData[0].id
      setSelectedVideoId(initialVideo)

      setLoading(false)
    }
    load()
  }, [courseId, router, requestedVideoId])

  if (loading) {
    return (
      <main className="min-h-screen bg-board text-chalk px-6 py-10 flex items-center justify-center">
        <p className="text-chalk/50">جاري التحميل...</p>
      </main>
    )
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-board text-chalk px-6 py-10 flex items-center justify-center">
        <div className="text-center">
          <p className="text-chalk/70 mb-4">
            مفيش فيديوهات متاحة، أو انت لسه مش مشترك في الكورس ده
          </p>
          <Link href={`/student/courses/${courseId}`} className="text-gold underline">
            روح لصفحة الكورس
          </Link>
        </div>
      </main>
    )
  }

  const term = searchTerm.trim()
  const matchesSearch = (v: Video) => !term || v.title.includes(term)

  const unsectionedVideos = videos.filter((v) => !v.section_id && matchesSearch(v))
  const visibleSections = sections
    .map((s) => ({ section: s, vids: videos.filter((v) => v.section_id === s.id && matchesSearch(v)) }))
    .filter((s) => s.vids.length > 0)

  const noResults = term && visibleSections.length === 0 && unsectionedVideos.length === 0

  return (
    <main className="min-h-screen bg-board text-chalk px-6 md:px-16 py-10">
      <div className="max-w-4xl mx-auto">
        <Link href="/student/dashboard" className="text-chalk/60 text-sm hover:text-gold">
          ← رجوع للداشبورد
        </Link>
        <h1 className="font-display text-2xl font-bold mt-4 mb-6">{courseTitle}</h1>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            {selectedVideoId && <VideoPlayer videoId={selectedVideoId} />}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold">محتوى الكورس</h3>
            </div>

            <input
              type="text"
              placeholder="دور في محتوى الكورس..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-boardLight border border-line rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-chalk/40 focus:outline-none focus:border-gold"
            />

            {noResults && <p className="text-chalk/40 text-xs">مفيش نتايج مطابقة</p>}

            {visibleSections.map(({ section, vids }) => (
              <div key={section.id}>
                <p className="text-gold text-xs font-bold mb-2">{section.title}</p>
                <div className="space-y-2">
                  {vids.map((video) => (
                    <VideoListItem
                      key={video.id}
                      video={video}
                      index={videos.filter((v) => v.section_id === section.id).findIndex((v) => v.id === video.id)}
                      isSelected={selectedVideoId === video.id}
                      progress={viewsByVideoId[video.id]}
                      onSelect={() => setSelectedVideoId(video.id)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {unsectionedVideos.length > 0 && (
              <div>
                {sections.length > 0 && (
                  <p className="text-chalk/40 text-xs font-bold mb-2">فيديوهات أخرى</p>
                )}
                <div className="space-y-2">
                  {unsectionedVideos.map((video, index) => (
                    <VideoListItem
                      key={video.id}
                      video={video}
                      index={index}
                      isSelected={selectedVideoId === video.id}
                      progress={viewsByVideoId[video.id]}
                      onSelect={() => setSelectedVideoId(video.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function VideoListItem({
  video,
  index,
  isSelected,
  progress,
  onSelect,
}: {
  video: Video
  index: number
  isSelected: boolean
  progress?: ViewProgress
  onSelect: () => void
}) {
  const percent =
    progress?.duration_seconds && progress.duration_seconds > 0
      ? Math.min(100, Math.round((progress.max_position_seconds / progress.duration_seconds) * 100))
      : 0

  return (
    <button
      onClick={onSelect}
      className={`w-full text-right rounded-lg px-4 py-3 border transition-colors ${
        isSelected ? 'bg-gold/10 border-gold text-gold' : 'bg-boardLight border-line hover:border-gold/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm">
          {index + 1}. {video.title}
        </span>
        {progress?.completed && <span className="text-gold text-xs">✓</span>}
      </div>
      {percent > 0 && !progress?.completed && (
        <div className="w-full bg-board rounded-full h-1 mt-2 overflow-hidden">
          <div className="bg-gold/70 h-full" style={{ width: `${percent}%` }} />
        </div>
      )}
    </button>
  )
}

export default function WatchCoursePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-board text-chalk px-6 py-10 flex items-center justify-center">
          <p className="text-chalk/50">جاري التحميل...</p>
        </main>
      }
    >
      <WatchCourseContent />
    </Suspense>
  )
}
