import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zakerly | منصة المعلمين أونلاين',
  description: 'منصة تجمع المعلمين بطلابهم: فيديوهات، متابعة، وتقارير في مكان واحد',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen font-body">{children}</body>
    </html>
  )
}
