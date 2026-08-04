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

// ده بيشتغل قبل كل صفحة/طلب، وبيجدد توكن الدخول لو قرب ينتهي
// من غير ده، المستخدم ممكن يتقطع دخوله فجأة وسط استخدامه للموقع
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

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
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
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
    // ⚠️ لو الاستعلام ده فشل لأي سبب (مشكلة شبكة مؤقتة مثلًا)، بنعتبر الصيانة
    // مقفولة (false) بدل ما نقفل المنصة كلها بالغلط بسبب خطأ مؤقت في القراءة -
    // فشل هنا لازم "يفتح" الموقع مش "يقفله" (fail-open لتوفر الخدمة)
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('maintenance_mode')
      .eq('id', true)
      .maybeSingle()

    if (settings?.maintenance_mode) {
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
