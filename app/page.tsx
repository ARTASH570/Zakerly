import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-board text-chalk">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-6 md:px-16 max-w-6xl mx-auto">
        <div className="text-2xl font-display font-bold tracking-tight">
          المدارس<span className="text-gold">.</span>
        </div>
        <Link
          href="/login"
          className="text-sm border border-line rounded-full px-5 py-2 hover:border-gold hover:text-gold transition-colors"
        >
          تسجيل الدخول
        </Link>
      </header>

      {/* Hero - على شكل جدول حصص مكتوب بالطباشير */}
      <section className="px-6 md:px-16 max-w-6xl mx-auto pt-10 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-gold text-sm tracking-wide mb-4">منصة المعلمين أونلاين</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight mb-6">
            حصتك، فيديوهاتك،
            <br />
            ومتابعة طلابك
            <br />
            <span className="text-gold">في مكان واحد.</span>
          </h1>
          <p className="text-chalk/70 text-lg leading-relaxed mb-8 max-w-md">
            ارفع فيديوهات كورساتك، خلّي الطلاب يدفعوا ويشوفوا حصصهم من غير تحميل أو مشاركة،
            وابعت تقارير أداء لأولياء الأمور أوتوماتيك.
          </p>
          <div className="flex gap-4">
            <Link
              href="/login?role=teacher"
              className="bg-gold text-board font-bold rounded-lg px-6 py-3 hover:bg-gold/90 transition-colors"
            >
              أنا معلم، عايز أبدأ
            </Link>
            <Link
              href="/login?role=student"
              className="border border-line rounded-lg px-6 py-3 hover:border-gold transition-colors"
            >
              عايز أختار معلم
            </Link>
          </div>
        </div>

        {/* الجدول - العنصر المميز في التصميم */}
        <div className="bg-boardLight border border-line rounded-2xl p-6 relative">
          <div className="absolute -top-3 right-6 bg-gold text-board text-xs font-bold px-3 py-1 rounded-full">
            جدول الأسبوع
          </div>
          <div className="space-y-3 mt-4">
            {[
              { day: 'السبت', subject: 'فيزياء - أ. محمد', time: '5:00 م' },
              { day: 'الأحد', subject: 'كيمياء - أ. سارة', time: '6:30 م' },
              { day: 'الثلاثاء', subject: 'فيزياء - أ. محمد', time: '5:00 م' },
            ].map((row) => (
              <div
                key={row.day + row.time}
                className="flex items-center justify-between border-b border-line/50 pb-3 last:border-0"
              >
                <div>
                  <p className="font-bold text-chalk">{row.subject}</p>
                  <p className="text-chalk/50 text-sm">{row.day}</p>
                </div>
                <span className="text-gold text-sm">{row.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* المميزات */}
      <section className="px-6 md:px-16 max-w-6xl mx-auto py-16 border-t border-line">
        <div className="grid md:grid-cols-3 gap-10">
          <Feature
            title="فيديوهات محمية"
            desc="الطالب اللي دافع بس هو اللي يشوف، من غير تحميل أو مشاركة للينك."
          />
          <Feature
            title="متابعة وتقييم"
            desc="سجّل حضور ودرجات كل طالب، وابعت تقرير شهري لولي الأمر أوتوماتيك."
          />
          <Feature
            title="دفع إلكتروني سهل"
            desc="الطالب يدفع بالبطاقة أو المحفظة، وفلوسك توصلك مباشرة."
          />
        </div>
      </section>

      <footer className="px-6 md:px-16 max-w-6xl mx-auto py-10 text-center text-chalk/40 text-sm border-t border-line">
        © {new Date().getFullYear()} المدارس
      </footer>
    </main>
  )
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h3 className="font-display font-bold text-lg mb-2 text-gold">{title}</h3>
      <p className="text-chalk/70 leading-relaxed">{desc}</p>
    </div>
  )
}
