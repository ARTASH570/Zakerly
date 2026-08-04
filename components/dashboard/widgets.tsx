export function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
}) {
  return (
    <div className="bg-paper border border-ink/10 rounded-2xl p-4 flex items-center gap-3 shadow-sm transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-md">
      <div className="w-10 h-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0 transition-transform duration-300 ease-smooth group-hover:scale-110">
        <span className="w-5 h-5 block">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-ink/50 text-xs mb-0.5">{label}</p>
        <p className="font-display font-bold text-lg truncate">{value}</p>
      </div>
    </div>
  )
}

const WEEKDAYS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

export function MiniCalendar() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-paper border border-ink/10 rounded-2xl p-4 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <p className="font-display font-bold text-sm mb-3">
        {MONTHS[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[11px] text-ink/40 font-bold">
            {w}
          </span>
        ))}
        {cells.map((d, i) => (
          <span
            key={i}
            className={`text-xs w-6 h-6 mx-auto flex items-center justify-center rounded-full transition-all duration-200 ${
              d === today.getDate()
                ? 'bg-gold text-board font-bold animate-pulse-soft'
                : d
                ? 'text-ink/70 hover:bg-ink/5 hover:scale-110'
                : ''
            }`}
          >
            {d ?? ''}
          </span>
        ))}
      </div>
    </div>
  )
}
