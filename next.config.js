/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // ⚠️ Content-Security-Policy اتنقل لملف middleware.ts عشان يقدر يستخدم nonce
    // مختلف لكل طلب (مينفعش هنا لأن headers() هنا بتتحسب مرة واحدة وقت الـ build
    // مش لكل request) - شوف middleware.ts لتفاصيل السبب والحل.
    return [
      {
        source: '/:path*',
        headers: [
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