/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // هوية Zakerly: مستوحاة من دفتر الحصص والسبورة - أخضر سبورة غامق كخلفية أساسية
        board: '#1B2E28',      // أخضر سبورة غامق - الخلفية الأساسية
        boardLight: '#24392F', // درجة أفتح شوية للبطاقات على الخلفية الغامقة
        chalk: '#F1EDE2',      // لون الطباشير الدافئ للنصوص على الغامق
        paper: '#FDFBF6',      // ورق فاتح للبطاقات على خلفية فاتحة
        ink: '#16241F',        // نص غامق على الخلفية الفاتحة
        gold: '#D9A441',       // لون القلم الذهبي - للأكشن والتمييز
        line: '#3A4E45',       // حدود هادئة على الغامق
      },
      fontFamily: {
        display: ['"IBM Plex Sans Arabic"', 'sans-serif'],
        body: ['"Noto Kufi Arabic"', 'sans-serif'],
      },
      // موشن المنصة: كل الحركات المستخدمة في الواجهة معرّفة هنا مركزيًا
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '70%': { opacity: '1', transform: 'scale(1.03)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-down': 'fadeInDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fadeIn 0.5s ease-out both',
        'scale-in': 'scaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slideInRight 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pop-in': 'popIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
