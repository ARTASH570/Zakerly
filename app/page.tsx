import Link from 'next/link'
import Reveal from '@/components/motion/Reveal'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-board text-chalk overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-6 md:px-16 max-w-6xl mx-auto animate-fade-in-down">
        <div className="text-2xl font-display font-bold tracking-tight">
          Zakerly<span className="text-gold">.</span>
        </div>
        <Link
          href="/login"
          className="text-sm border border-line rounded-full px-5 py-2 transition-all duration-200 ease-smooth hover:border-gold hover:text-gold hover:scale-105 active:scale-95"
        >
          تسجيل الدخول
        </Link>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-16 max-w-3xl mx-auto pt-10 pb-20 text-center">
        <Reveal as="fade-in-up" delay={80}>
          <p className="text-gold text-sm tracking-wide mb-4">منصة المعلمين أونلاين</p>
        </Reveal>
        <Reveal as="fade-in-up" delay={160}>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight mb-6">
            حصتك، فيديوهاتك،
            <br />
            ومتابعة طلابك
            <br />
            <span className="text-gold">في مكان واحد.</span>
          </h1>
        </Reveal>
        <Reveal as="fade-in-up" delay={260}>
          <p className="text-chalk/70 text-lg leading-relaxed mb-8 max-w-md mx-auto">
            ارفع فيديوهات كورساتك، خلّي الطلاب يدفعوا ويشوفوا حصصهم من غير تحميل أو مشاركة،
            وابعت تقارير أداء لأولياء الأمور أوتوماتيك.
          </p>
        </Reveal>
        <Reveal as="scale-in" delay={360}>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login/teacher"
              className="bg-gold text-board font-bold rounded-lg px-6 py-3 transition-all duration-200 ease-smooth hover:bg-gold/90 hover:scale-105 hover:shadow-lg hover:shadow-gold/20 active:scale-95"
            >
              أنا معلم، عايز أبدأ
            </Link>
            <Link
              href="/login/student"
              className="border border-line rounded-lg px-6 py-3 transition-all duration-200 ease-smooth hover:border-gold hover:scale-105 active:scale-95"
            >
              أنا طالب
            </Link>
          </div>
        </Reveal>
      </section>

      {/* المميزات */}
      <section className="px-6 md:px-16 max-w-6xl mx-auto py-16 border-t border-line">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10">
          <Feature
            title="دفع إلكتروني سهل"
            desc="تقدر تدفع بالبطاقة أو المحفظة من أي مكان في العالم."
            delay={0}
          />
          <Feature
            title="فيديوهات مسجلة"
            desc="يشوفها الطالب في أي وقت."
            delay={100}
          />
          <Feature
            title="حصص مباشرة"
            desc="لايف على زوم في أي وقت يحتاجه الطالب، ويدخل من نفس المنصة."
            delay={200}
          />
          <Feature
            title="متابعة وتقييم دوري"
            desc="حضور ودرجات وتقرير شهري لولي الأمر."
            delay={300}
          />
        </div>
      </section>

      <footer className="px-6 md:px-16 max-w-6xl mx-auto py-10 text-center text-chalk/40 text-sm border-t border-line">
        © {new Date().getFullYear()} Zakerly
      </footer>
    </main>
  )
}

function Feature({ title, desc, delay }: { title: string; desc: string; delay: number }) {
  return (
    <Reveal as="fade-in-up" delay={delay} onScroll className="group">
      <div className="transition-transform duration-300 ease-smooth group-hover:-translate-y-1">
        <h3 className="font-display font-bold text-lg mb-2 text-gold transition-colors">{title}</h3>
        <p className="text-chalk/70 leading-relaxed">{desc}</p>
      </div>
    </Reveal>
  )
}
