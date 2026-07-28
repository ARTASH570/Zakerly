/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // هوية elmodares: مستوحاة من دفتر الحصص والسبورة - أخضر سبورة غامق كخلفية أساسية
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
    },
  },
  plugins: [],
}
