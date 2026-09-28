/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0b1220',
          900: '#0f1a2e',
          800: '#172542',
          700: '#22335a',
        },
        wine: {
          50: '#fdf2f6',
          100: '#fbe7ee',
          200: '#f5c7da',
          300: '#e99cbb',
          400: '#d96693',
          500: '#c13d70',
          600: '#a12a5b',
          700: '#821f49',
          800: '#6c1a3d',
          900: '#591833',
          950: '#33081b',
        },
        blush: '#fbf5f7',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 14px rgba(15, 26, 46, 0.06)',
        card: '0 6px 24px rgba(15, 26, 46, 0.08)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
