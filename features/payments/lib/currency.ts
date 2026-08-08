/**
 * تحويل السعر من الجنيه المصري (العملة الأساسية اللي بيتسعر بيها كل كورس)
 * بياخدوا الدفع بالدولار بـ PayPal وStripe - مطلوب لأن الدفع بياخد جنيه
 * مباشرة في paymob.ts (فيها `currency: 'EGP'`) على عكس الاتنين التانيين.
 *
 * ⚠️ السعر بيتجاب لحظيًا (تقريبًا) من API خارجي مجاني، مع:
 *   - Cache لمدة ساعة (عشان منعملش fetch لكل عملية دفع، وأسرع للمستخدم)
 *   - Fallback على قيمة ثابتة من الـ env (EGP_TO_USD_RATE) لو الـ API
 *     الخارجي فشل أو كان بطيء، عشان الدفع ميوقفش أبدًا بسبب مشكلة
 *     في خدمة خارجية مش تحت سيطرتنا.
 *
 * المصدر: open.er-api.com (مجاني، من غير API key، تحديث كل ساعة تقريبًا)
 */

const EXCHANGE_API_URL = 'https://open.er-api.com/v6/latest/USD'
const CACHE_DURATION_MS = 60 * 60 * 1000 // ساعة واحدة
const FETCH_TIMEOUT_MS = 3000 // 3 ثواني - لو الـ API اتأخر، منستناهوش أكتر من كده

// Cache بسيط في الذاكرة (in-memory) - كافي لـ serverless function عادية
// بتفضل شغالة (warm) بين الطلبات المتقاربة
let cachedRate: { egpToUsd: number; fetchedAt: number } | null = null

function getFallbackRate(): number {
  const rate = Number(process.env.EGP_TO_USD_RATE)

  if (!rate  rate <= 0  Number.isNaN(rate)) {
    throw new Error(
      'متغير البيئة EGP_TO_USD_RATE غير موجود أو غير صحيح - لازم يكون رقم أكبر من صفر ' +
        '(مثلاً 0.021 لو الدولار بـ ~47 جنيه) كـ fallback احتياطي في حالة فشل ' +
        'الـ API الخارجي لجلب سعر الصرف اللحظي.'
    )
  }

  return rate
}

async function fetchLiveRate(): Promise<number> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(EXCHANGE_API_URL, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) {
      throw new Error(`Exchange rate API responded with status ${res.status}`)
    }

    const data = await res.json()
    const egpPerUsd = data?.rates?.EGP

    if (!egpPerUsd  typeof egpPerUsd !== 'number'  egpPerUsd <= 0) {
      throw new Error('Exchange rate API returned invalid EGP rate')
    }

    // الـ API بيرجع "كام جنيه في الدولار" - إحنا محتاجين العكس
    // (كام دولار في الجنيه) عشان نضربه في المبلغ بالجنيه
    return 1 / egpPerUsd
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

/**
 * بيرجع سعر تحويل الجنيه للدولار (كام دولار في الجنيه الواحد).
 * بيحاول يجيب السعر اللحظي، ولو الـ cache لسه صالح (أقل من ساعة) بيستخدمه
 * بدل ما يعمل fetch تاني. لو الـ API الخارجي فشل، بيرجع للـ fallback.
 */
async function getEgpToUsdRate(): Promise<number> {
  const now = Date.now()

  if (cachedRate && now - cachedRate.fetchedAt < CACHE_DURATION_MS) {
    return cachedRate.egpToUsd
  }

  try {
    const liveRate = await fetchLiveRate()
    cachedRate = { egpToUsd: liveRate, fetchedAt: now }
    return liveRate
  } catch (err) {
    console.error('فشل جلب سعر الصرف اللحظي، هنستخدم القيمة الاحتياطية:', err)

    // لو عندنا cache قديم حتى لو منتهي الصلاحية، أحسن من رقم ثابت قديم جدًا
    if (cachedRate) {
      return cachedRate.egpToUsd
    }

    return getFallbackRate()
  }
}

export async function egpToUsdCents(amountEgp: number): Promise<number> {
  const rate = await getEgpToUsdRate()
  const usd = amountEgp * rate
  return Math.round(usd * 100)
}