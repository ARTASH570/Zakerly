'use client'

import { useState } from 'react'
import * as tus from 'tus-js-client'

interface VideoUploaderProps {
  courseId: string
  sectionId: string
  onUploaded?: () => void
}

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024 // 2 جيجا - حد معقول لمحاضرة واحدة

type FileStatus = 'queued' | 'uploading' | 'done' | 'error'

interface QueuedFile {
  file: File
  title: string
  progress: number
  status: FileStatus
  errorMsg?: string
}

// بيشيل امتداد الملف عشان يقترح اسم مبدئي للفيديو (المعلم يقدر يعدله لسه)
function suggestTitle(filename: string) {
  return filename.replace(/\.[^/.]+$/, '')
}

export default function VideoUploader({ courseId, sectionId, onUploaded }: VideoUploaderProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [uploading, setUploading] = useState(false)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || [])
    const tooLarge = selected.filter((f) => f.size > MAX_FILE_SIZE_BYTES)

    const valid = selected
      .filter((f) => f.size <= MAX_FILE_SIZE_BYTES)
      .map((file) => ({
        file,
        title: suggestTitle(file.name),
        progress: 0,
        status: 'queued' as FileStatus,
      }))

    setQueue(valid)
    e.target.value = ''

    if (tooLarge.length > 0) {
      alert(`${tooLarge.length} فيديو أكبر من 2 جيجا اتشال من القايمة تلقائيًا`)
    }
  }

  function updateFileTitle(index: number, newTitle: string) {
    setQueue((prev) => prev.map((f, i) => (i === index ? { ...f, title: newTitle } : f)))
  }

  function uploadOne(index: number): Promise<void> {
    return new Promise(async (resolve) => {
      const item = queue[index]

      setQueue((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: 'uploading' } : f))
      )

      try {
        const res = await fetch('/api/videos/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, sectionId, title: item.title }),
        })
        const creds = await res.json()

        if (!res.ok) {
          setQueue((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, status: 'error', errorMsg: creds.error } : f
            )
          )
          resolve()
          return
        }

        const upload = new tus.Upload(item.file, {
          endpoint: 'https://video.bunnycdn.com/tusupload',
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            AuthorizationSignature: creds.signature,
            AuthorizationExpire: String(creds.expirationTime),
            VideoId: creds.videoId,
            LibraryId: String(creds.libraryId),
          },
          metadata: { filetype: item.file.type, title: item.title },
          onError: () => {
            setQueue((prev) =>
              prev.map((f, i) =>
                i === index ? { ...f, status: 'error', errorMsg: 'فشل الرفع' } : f
              )
            )
            resolve()
          },
          onProgress: (uploaded, total) => {
            const progress = Math.round((uploaded / total) * 100)
            setQueue((prev) => prev.map((f, i) => (i === index ? { ...f, progress } : f)))
          },
          onSuccess: () => {
            setQueue((prev) =>
              prev.map((f, i) => (i === index ? { ...f, status: 'done', progress: 100 } : f))
            )
            resolve()
          },
        })

        upload.start()
      } catch {
        setQueue((prev) =>
          prev.map((f, i) => (i === index ? { ...f, status: 'error', errorMsg: 'حصل خطأ' } : f))
        )
        resolve()
      }
    })
  }

  async function handleUploadAll() {
    if (queue.length === 0) return
    setUploading(true)

    // بنرفع واحد ورا التاني (مش كلهم مرة واحدة) عشان منضغطش على حد الرفع الساعي
    // ومنستهلكش باندويدث المعلم كله دفعة واحدة
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === 'queued') {
        await uploadOne(i)
      }
    }

    setUploading(false)
    onUploaded?.()
  }

  return (
    <div className="bg-boardLight border border-line rounded-xl p-6">
      <h3 className="font-display font-bold mb-2">ارفع فيديو أو أكتر</h3>
      <p className="text-chalk/40 text-xs mb-4">
        تقدر تختار أكتر من فيديو مرة واحدة - هيتم رفعهم واحد ورا التاني تلقائيًا. الحد الأقصى: 2 جيجا لكل فيديو
      </p>

      <input
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileSelect}
        disabled={uploading}
        className="w-full text-chalk/70 text-sm mb-4"
      />

      {queue.length > 0 && (
        <div className="space-y-3 mb-4">
          {queue.map((item, index) => (
            <div key={index} className="bg-board border border-line rounded-lg p-3">
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateFileTitle(index, e.target.value)}
                disabled={item.status !== 'queued'}
                className="w-full bg-transparent text-chalk text-sm mb-2 focus:outline-none border-b border-line/50 pb-1"
              />
              {item.status === 'uploading' && (
                <div className="w-full bg-boardLight rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gold h-full transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {item.status === 'done' && <p className="text-gold text-xs">تم الرفع ✓</p>}
              {item.status === 'error' && (
                <p className="text-red-400 text-xs">{item.errorMsg || 'فشل'}</p>
              )}
              {item.status === 'queued' && <p className="text-chalk/40 text-xs">في الانتظار</p>}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleUploadAll}
        disabled={uploading || queue.length === 0}
        className="bg-gold text-board font-bold rounded-lg px-6 py-3 hover:bg-gold/90 transition-colors disabled:opacity-50 w-full"
      >
        {uploading
          ? 'جاري الرفع... متقفلش الصفحة'
          : queue.length > 1
            ? `ابدأ رفع الـ ${queue.length} فيديوهات`
            : 'ابدأ الرفع'}
      </button>
    </div>
  )
}
