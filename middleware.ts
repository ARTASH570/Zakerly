import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// المسارات المسموحة دايمًا حتى لو الصيانة شغالة - عشان أي حد (وخصوصًا الأدمن)
// يقدر يسجل دخول ويشوف صفحة الصيانة نفسها، ومسارات الـ auth الأساسية تفضل شغالة
const MAINTENANCE_ALLOWED_PREFIXES = [
  '/maintenance',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/register-success',
  '/api/auth',
]

function isAlwaysAllowed(pathname: string): boolean {
  return MAINTENANCE_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// 🔴 إصلاح أداء: كان بيستعلم عن platform_settings في كل طلب وطلب على كل
// المنصة (مش بس وقت الصيانة الفعلية) - ده تكلفة إضافية ثابتة على كل تحميل
// صفحة وكل نداء API، رغم إن maintenance_mode قيمة نادرًا ما بتتغيّر (الأدمن
// بيفعّلها/يطفيها يدوي). بنكاش القيمة هنا لمدة قصيرة (20 ثانية) على مستوى
// الـ instance عشان نقلل عدد الاستعلامات الفعلية من "كل طلب" لـ "مرة كل 20
// ثانية بالكتير" من غير ما نغيّر أي سلوك ملموس - أدمن بيفعّل الصيانة هيتطبق
// خلال 20 ثانية كحد أقصى بدل فوري تمامًا، وده فرق مش محسوس عمليًا.
let maintenanceCache: { value: boolean; expiresAt: number } | null = null
const MAINTENANCE_CACHE_TTL_MS = 20_000

// بيبني الـ Content-Security-Policy باستخدام nonce فريد لكل طلب بدل
// 'unsafe-inline' - كده الـ inline scripts اللي Next.js نفسه محتاجها للـ
// hydration بتشتغل عادي (لأن عندها الـ nonce الصح)، لكن أي سكريبت مزروع
// بهجوم XSS مش هيكون عارف الـ nonce فمش هيشتغل - ده أفضل من إما نمنع كل
// الـ inline scripts (وده بيكسر الموقع زي ما حصل) أو نسمح بيهم كلهم
// (وده بيلغي فايدة الـ CSP ضد XSS)
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production'
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://assets.mediadelivery.net`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://assets.mediadelivery.net`

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "base-uri 'self'",
    "object-src 'none'",
    "connect-src 'self' https://*.supabase.co https://api-m.paypal.com https://api-m.sandbox.paypal.com https://api.stripe.com https://*.bunnycdn.com https://video.bunnycdn.com https://*.b-cdn.net https://*.sentry.io",
    "frame-src 'self' https://iframe.mediadelivery.net https://accept.paymob.com https://*.paypal.com https://checkout.stripe.com",
    "frame-ancestors 'self'",
  ].join('; ')
}

// ده بيشتغل قبل كل صفحة/طلب، وبيجدد توكن الدخول لو قرب ينتهي
// من غير ده، المستخدم ممكن يتقطع دخوله فجأة وسط استخدامه للموقع
export async function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const csp = buildCsp(nonce)

  // بنحط الـ nonce كـ header على الـ request نفسه عشان Next.js يقدر يقراه
  // ويطبقه تلقائيًا على الـ inline scripts بتاعته وقت الـ render
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  let response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: requestHeaders } })
          response.headers.set('Content-Security-Policy', csp)
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: requestHeaders } })
          response.headers.set('Content-Security-Policy', csp)
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!isAlwaysAllowed(pathname)) {
    const now = Date.now()
    let maintenanceMode: boolean

    if (maintenanceCache && maintenanceCache.expiresAt > now) {
      maintenanceMode = maintenanceCache.value
    } else {
      // ⚠️ لو الاستعلام ده فشل لأي سبب (مشكلة شبكة مؤقتة مثلًا)، بنعتبر الصيانة
      // مقفولة (false) بدل ما نقفل المنصة كلها بالغلط بسبب خطأ مؤقت في القراءة -
      // فشل هنا لازم "يفتح" الموقع مش "يقفله" (fail-open لتوفر الخدمة). بنكاش
      // نتيجة الفشل دي كمان لمدة قصيرة عشان مانضربش Supabase بمحاولات متكررة
      // في حالة انقطاع فعلي، بنفس منطق fail-open الأصلي بالظبط.
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('maintenance_mode')
        .eq('id', true)
        .maybeSingle()

      maintenanceMode = !!settings?.maintenance_mode
      maintenanceCache = { value: maintenanceMode, expiresAt: now + MAINTENANCE_CACHE_TTL_MS }
    }

    if (maintenanceMode) {
      let isAdmin = false
      if (user) {
        const { data: adminRow } = await supabase
          .from('admins')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()
        isAdmin = !!adminRow
      }

      if (!isAdmin) {
        // طلبات الـ API بترجع JSON واضح بدل ما توديه لصفحة HTML
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'المنصة تحت الصيانة حاليًا' },
            { status: 503 }
          )
        }
        return NextResponse.redirect(new URL('/maintenance', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
