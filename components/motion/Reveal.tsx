'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'

type Animation = 'fade-in-up' | 'fade-in-down' | 'fade-in' | 'scale-in' | 'slide-in-right' | 'pop-in'

interface RevealProps {
  children: ReactNode
  /** نوع الحركة عند الظهور */
  as?: Animation
  /** تأخير بالمللي ثانية - مفيد لعمل تتابع (stagger) بين عناصر قايمة */
  delay?: number
  /** لو true، الحركة بتشتغل أول ما العنصر يدخل الشاشة (سكرول). لو false بتشتغل فور التحميل */
  onScroll?: boolean
  className?: string
}

const ANIMATION_CLASS: Record<Animation, string> = {
  'fade-in-up': 'animate-fade-in-up',
  'fade-in-down': 'animate-fade-in-down',
  'fade-in': 'animate-fade-in',
  'scale-in': 'animate-scale-in',
  'slide-in-right': 'animate-slide-in-right',
  'pop-in': 'animate-pop-in',
}

/**
 * Wrapper موحّد للحركة في كل المنصة: بيبان العنصر بشفافية 0 الأول، وبعدين
 * يشغّل أنيميشن Tailwind المناسب - إما فور التحميل أو أول ما يدخل نطاق الشاشة.
 * بديل عن مكتبة motion خارجية (زي framer-motion) عشان مايحصلش خطر تعليق
 * على تثبيت باكدج جديدة، بنفس الإحساس البصري.
 */
export default function Reveal({
  children,
  as = 'fade-in-up',
  delay = 0,
  onScroll = false,
  className = '',
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(!onScroll)

  useEffect(() => {
    if (!onScroll) return
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [onScroll])

  return (
    <div
      ref={ref}
      className={`${visible ? ANIMATION_CLASS[as] : 'opacity-0'} ${className}`}
      style={visible ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
