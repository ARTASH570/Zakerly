'use client'

import { useEffect, useRef, useState } from 'react'

export default function ProgressRing({
  percent,
  color = '#D9A441',
  trackColor = 'rgba(241,237,226,0.15)',
  size = 84,
  label,
  value,
}: {
  percent: number
  color?: string
  trackColor?: string
  size?: number
  label?: string
  value?: string | number
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const [animated, setAnimated] = useState(0)
  const frameRef = useRef<number>()

  useEffect(() => {
    const start = performance.now()
    const duration = 900
    const from = 0

    function tick(now: number) {
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      // ease-out cubic - إحساس "بيهدي" في الآخر بدل ما يقف فجأة
      const eased = 1 - Math.pow(1 - t, 3)
      setAnimated(from + (clamped - from) * eased)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [clamped])

  return (
    <div className="flex flex-col items-center gap-1.5 animate-scale-in transition-transform duration-300 hover:scale-105" style={{ width: size }}>
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${color} ${animated * 3.6}deg, ${trackColor} 0deg)`,
        }}
      >
        <div
          className="rounded-full bg-board flex items-center justify-center font-display font-bold"
          style={{ width: size - 14, height: size - 14, fontSize: size * 0.19 }}
        >
          {value ?? `${Math.round(animated)}%`}
        </div>
      </div>
      {label && <span className="text-xs text-chalk/60 text-center">{label}</span>}
    </div>
  )
}
