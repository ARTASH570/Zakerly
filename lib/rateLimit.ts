import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// لو متغيرات Upstash موجودة، بنستخدم Redis حقيقي (دقيق حتى لو السيرفر شغال
// على نسخ متعددة بالتوازي زي ما بيحصل على Vercel). لو مش موجودة (مثلاً وقت
// التطوير المحلي)، بنرجع لنسخة بسيطة في الذاكرة عشان المشروع يفضل شغال.
let hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

let redis: Redis | null = null
if (hasUpstash) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  } catch (err) {
    // ⚠️ لو حصل أي خطأ في التهيئة نفسها (رابط غلط، إلخ)، منخليش المشروع كله يقع -
    // نرجع لوضع "مفيش Upstash" ونستخدم الـ fallback بدل ما نكسر كل حاجة
    console.error('[rateLimit] فشل الاتصال بـ Upstash، هنستخدم fallback:', err)
    hasUpstash = false
    redis = null
  }
}

// كاش بسيط لكائنات الـ Ratelimit عشان منعملش واحد جديد كل طلب
const limiters = new Map<string, Ratelimit>()

function getLimiter(maxAttempts: number, windowSeconds: number): Ratelimit {
  const cacheKey = `${maxAttempts}:${windowSeconds}`
  if (!limiters.has(cacheKey)) {
    limiters.set(
      cacheKey,
      new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(maxAttempts, `${windowSeconds} s`),
        analytics: true,
      })
    )
  }
  return limiters.get(cacheKey)!
}

// نسخة بديلة في الذاكرة لو Upstash مش متظبط بعد (تطوير محلي فقط)
const memoryAttempts = new Map<string, { count: number; resetAt: number }>()

function checkMemoryRateLimit(key: string, maxAttempts: number, windowSeconds: number): boolean {
  const now = Date.now()
  const record = memoryAttempts.get(key)

  if (!record || now > record.resetAt) {
    memoryAttempts.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    return true
  }

  if (record.count >= maxAttempts) return false

  record.count++
  return true
}

/**
 * بيتأكد إن المستخدم مش بعت أكتر من الحد المسموح خلال فترة زمنية معينة (بالثواني)
 * بيرجع true لو مسموحله يكمل، false لو لازم يستنى
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<boolean> {
  // ✅ تجاوز صريح لوضع التطوير بس: لو شغالين محليًا (NODE_ENV=development) ومفيش
  // متغيرات Upstash متظبطة، نتخطى فحص الـ rate limit كليًا ونسمح بالطلب.
  // ⚠️ ده بيشتغل بس لو الشرطين اتحققوا مع بعض - في الإنتاج (NODE_ENV=production)
  // المنطق الأصلي فاضل زي ما هو من غير أي تغيير، حتى لو Upstash مش متظبط بالغلط
  // (هيرجع لنسخة الذاكرة البديلة تحت، مش يتخطى الفحص خالص).
  if (process.env.NODE_ENV === 'development' && !hasUpstash) {
    console.warn(
      `[rateLimit] تخطي الفحص في وضع التطوير (Upstash مش متظبط) - key: ${key}`
    )
    return true
  }

  if (!hasUpstash) {
    // ⚠️ ده بيحصل في الإنتاج بس لو حد نسي يظبط متغيرات Upstash - نسخة الذاكرة
    // دي شغالة كـ fallback أخير، بس مش دقيقة 100% لو السيرفر شغال بنسخ متعددة بالتوازي
    return checkMemoryRateLimit(key, maxAttempts, windowSeconds)
  }

  try {
    const limiter = getLimiter(maxAttempts, windowSeconds)
    const { success } = await limiter.limit(key)
    return success
  } catch (err) {
    // ⚠️ لو حصل خطأ شبكة أو أي مشكلة في الاتصال بـ Upstash وقت التشغيل الفعلي،
    // منسيبش المستخدم ياخد 500 - نرجع لفحص الذاكرة كـ fallback بدل ما نوقف الطلب
    console.error('[rateLimit] فشل استدعاء Upstash وقت التشغيل، هنستخدم fallback:', err)
    return checkMemoryRateLimit(key, maxAttempts, windowSeconds)
  }
}
