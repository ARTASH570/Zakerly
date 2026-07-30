/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // بنسمح بالـ iframe بس من bunny (لمشغل الفيديو) ومن بوابات الدفع اللي محتاجة redirect
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://assets.mediadelivery.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api-m.paypal.com https://api-m.sandbox.paypal.com https://api.stripe.com https://*.bunnycdn.com https://video.bunnycdn.com https://*.b-cdn.net https://*.sentry.io",
      "frame-src 'self' https://iframe.mediadelivery.net https://accept.paymob.com https://*.paypal.com https://checkout.stripe.com",
      "frame-ancestors 'self'",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          // Content-Security-Policy: بيحدد بالظبط مصادر السكريبت/الصور/الاتصالات المسموحة،
          // بيقلل بشكل كبير من احتمالية هجمات XSS حتى لو حصل خطأ برمجي في مكان ما
          { key: 'Content-Security-Policy', value: csp },
          // HSTS: بيجبر المتصفح يستخدم HTTPS بس مع الموقع لمدة سنة، حتى لو المستخدم كتب http:// بالغلط
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // بيمنع الموقع يتحط جوه iframe في موقع تاني (يمنع هجمات clickjacking)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // بيمنع المتصفح يحاول "يخمن" نوع الملف بدل ما يصدّق الـ header الحقيقي
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // بيتحكم في قد إيه معلومات بتتسرب في الـ referrer لما تروح لموقع تاني
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // بيمنع المتصفح يستخدم كاميرا/مايك/موقع الجهاز من غير داعي
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

// لو SENTRY_DSN مش متظبط، Sentry بيتجاهل نفسه تلقائيًا من غير ما يعطّل حاجة
module.exports = withSentryConfig(nextConfig, {
  silent: true, // مايطبعش لوجات زيادة وقت الـ build
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
})
