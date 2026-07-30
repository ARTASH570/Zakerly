'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

interface VideoPlayerProps {
  videoId: string
}

// عنوان مكتبة player.js الرسمية اللي Bunny بتستضيفها - بتخلينا نتواصل مع الـ iframe
// ونستقبل أحداث زي timeupdate/ended من غير ما نلمس أي كود جوه Bunny نفسها
const PLAYERJS_SRC = 'https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js'

export default function VideoPlayer({ videoId }: VideoPlayerProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [playerjsReady, setPlayerjsReady] = useState(false)
  const [speed, setSpeed] = useState(1)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastSentRef = useRef(0)
  const playerRef = useRef<any>(null)

  const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2]

  useEffect(() => {
    async function fetchPlaybackUrl() {
      setLoading(true)
      setErrorMsg('')

      try {
        const res = await fetch('/api/videos/playback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId }),
        })

        const data = await res.json()

        if (!res.ok) {
          setErrorMsg(data.error || 'مش قادر أفتح الفيديو')
          return
        }

        setEmbedUrl(data.embedUrl)
      } catch {
        setErrorMsg('حصل خطأ في الاتصال')
      } finally {
        setLoading(false)
      }
    }

    fetchPlaybackUrl()
  }, [videoId])

  // بعد ما الـ iframe يتحمّل ومكتبة player.js تكون جاهزة، بنسمع لأحداث المشغل
  useEffect(() => {
    if (!playerjsReady || !embedUrl || !iframeRef.current) return

    // @ts-expect-error - playerjs بتتحمل من سكريبت خارجي، مش عندها types جاهزة
    const player = new window.playerjs.Player(iframeRef.current)
    playerRef.current = player

    function sendHeartbeat(positionSeconds: number, durationSeconds?: number) {
      // منبعتش نبضة كل timeupdate (بيحصل كل ثانية تقريبًا) - كل 15 ثانية بس كافي
      const now = Date.now()
      if (now - lastSentRef.current < 15_000) return
      lastSentRef.current = now

      fetch('/api/videos/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, positionSeconds, durationSeconds }),
      }).catch(() => {
        // فشل نبضة واحدة مش مهم - هتتبعت واحدة تانية بعد شوية
      })
    }

    player.on('ready', () => {
      player.getDuration((duration: number) => {
        player.on('timeupdate', (data: { seconds: number; duration: number }) => {
          sendHeartbeat(data.seconds, data.duration || duration)
        })
      })
    })

    player.on('ended', () => {
      // نتأكد إن آخر نبضة بتوصل فورًا لما الفيديو يخلص، مش تستنى الـ 15 ثانية
      lastSentRef.current = 0
      player.getDuration((duration: number) => {
        sendHeartbeat(duration, duration)
      })
    })
  }, [playerjsReady, embedUrl, videoId])

  if (loading) {
    return (
      <div className="bg-boardLight border border-line rounded-xl aspect-video flex items-center justify-center">
        <p className="text-chalk/50">جاري تجهيز الفيديو...</p>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="bg-boardLight border border-line rounded-xl aspect-video flex items-center justify-center px-6">
        <p className="text-red-400 text-center">{errorMsg}</p>
      </div>
    )
  }

  function changeSpeed(rate: number) {
    setSpeed(rate)
    // player.js بيدعم setPlaybackRate رسميًا كجزء من الـ API القياسي بتاعه
    playerRef.current?.setPlaybackRate?.(rate)
  }

  return (
    <>
      <Script src={PLAYERJS_SRC} onLoad={() => setPlayerjsReady(true)} />
      <div className="rounded-xl overflow-hidden aspect-video">
        <iframe
          ref={iframeRef}
          src={embedUrl!}
          loading="lazy"
          style={{ border: 0, width: '100%', height: '100%' }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-chalk/40 text-xs">السرعة:</span>
        {SPEED_OPTIONS.map((rate) => (
          <button
            key={rate}
            onClick={() => changeSpeed(rate)}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              speed === rate ? 'bg-gold text-board font-bold' : 'text-chalk/50 hover:text-chalk'
            }`}
          >
            {rate}x
          </button>
        ))}
      </div>
    </>
  )
}
