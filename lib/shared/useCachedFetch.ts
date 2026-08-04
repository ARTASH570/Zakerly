'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

// ⚠️ الكاش ده في الذاكرة بس (module-level)، معناها بيتصفّر لوحده لما المستخدم
// يعمل ريفريش كامل للصفحة، ومش بيتشارك بين مستخدمين مختلفين (كل تاب متصفح
// له نسخته بذاكرته لوحده) - مناسب للبيانات العامة/الغير حساسة اللي بتتكرر
// قراءتها كتير أثناء تنقل المستخدم بين الصفحات في نفس الجلسة
const memoryCache = new Map<string, CacheEntry<unknown>>()
// بيمنع إطلاق نفس الطلب أكتر من مرة في نفس اللحظة (مثلاً لو نفس المكوّن
// اتعمله mount مرتين بسرعة، أو صفحتين مختلفتين محتاجين نفس المفتاح مع بعض)
const inFlight = new Map<string, Promise<unknown>>()

export function invalidateCache(key: string) {
  memoryCache.delete(key)
  inFlight.delete(key)
}

/**
 * بديل خفيف عن مكتبات زي SWR/React Query - بيكاش نتيجة أي fetcher في الذاكرة
 * لمدة ttlMs، وبيرجع النسخة المخزّنة فورًا (من غير spinner تحميل) لو لسه
 * صالحة، بدل ما يضرب الداتابيز/الـ API من الأول في كل مرة الصفحة تتفتح.
 *
 * ⚠️ استخدمها بس للبيانات العامة أو الغير حساسة لتأخير بسيط (كذا ثانية لحد
 * دقيقة) مقبول فيه - مش لبيانات مالية أو حساسة لازم تبقى فريش 100% دايمًا.
 */
export function useCachedFetch<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  ttlMs: number = 60_000
) {
  const cached = key ? (memoryCache.get(key) as CacheEntry<T> | undefined) : undefined
  const isFresh = !!cached && cached.expiresAt > Date.now()

  const [data, setData] = useState<T | null>(isFresh ? cached!.data : null)
  const [loading, setLoading] = useState(!isFresh)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const load = useCallback(
    async (force = false) => {
      if (!key) return

      const existing = memoryCache.get(key) as CacheEntry<T> | undefined
      if (!force && existing && existing.expiresAt > Date.now()) {
        setData(existing.data)
        setLoading(false)
        return
      }

      // لو فيه طلب شغال بالفعل لنفس المفتاح، منستناش طلب جديد - بننضم للي شغال
      let promise = inFlight.get(key) as Promise<T> | undefined
      if (!promise) {
        promise = fetcherRef.current()
        inFlight.set(key, promise)
      }

      setLoading(true)
      setError(null)
      try {
        const result = await promise
        memoryCache.set(key, { data: result, expiresAt: Date.now() + ttlMs })
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حصل خطأ في تحميل البيانات')
      } finally {
        inFlight.delete(key)
        setLoading(false)
      }
    },
    [key, ttlMs]
  )

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const refresh = useCallback(() => load(true), [load])

  return { data, loading, error, refresh }
}
