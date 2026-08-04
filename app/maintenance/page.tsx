import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function MaintenancePage() {
  const { data: settings } = await supabaseAdmin
    .from('platform_settings')
    .select('maintenance_mode, maintenance_message')
    .eq('id', true)
    .maybeSingle()

  // لو حد فتح الرابط ده يدوي والصيانة أصلًا مقفولة، منوريهوش رسالة غلط -
  // نديله رابط رجوع واضح للصفحة الرئيسية
  const isActive = settings?.maintenance_mode ?? false

  return (
    <main className="min-h-screen bg-board text-chalk flex items-center justify-center px-6 text-center">
      <div className="max-w-md animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl bg-gold/15 text-gold flex items-center justify-center mx-auto mb-6">
          <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
            <path
              d="M14.7 6.3a4 4 0 0 0-5.6 5.6L4 17v3h3l5.1-5.1a4 4 0 0 0 5.6-5.6l-2.8 2.8-2-2 2.8-2.8Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-bold mb-3">Zakerly تحت الصيانة</h1>
        <p className="text-chalk/70 leading-relaxed mb-8">
          {isActive
            ? settings?.maintenance_message || 'المنصة تحت الصيانة دلوقتي، هنرجعلكم قريب.'
            : 'الصيانة خلصت، تقدر ترجع تستخدم المنصة عادي.'}
        </p>
        <Link
          href="/"
          className="inline-block bg-gold text-board font-bold rounded-lg px-6 py-3 transition-all duration-200 ease-smooth hover:bg-gold/90 hover:scale-105 active:scale-95"
        >
          {isActive ? 'حاول تاني' : 'رجوع للصفحة الرئيسية'}
        </Link>
      </div>
    </main>
  )
}
