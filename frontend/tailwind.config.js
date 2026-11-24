/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Newsreader', 'Georgia', 'Cambria', 'serif'],
      },
      colors: {
        navy: {
          50: '#f2f6fb', 100: '#e2ebf6', 200: '#c5d6ec', 300: '#98b4d9', 400: '#6489c2',
          500: '#4068a8', 600: '#2f4f8a', 700: '#263f6f', 800: '#1b2f55', 900: '#12223f', 950: '#0a1628',
        },
        teal: {
          50: '#effcfa', 100: '#d3f7f1', 200: '#a9eee3', 300: '#72ddd0', 400: '#3cc5b7',
          500: '#17aa9e', 600: '#0c7d76', 700: '#0e625d', 800: '#115755', 900: '#124847',
        },
        // slate-400 darkened so small secondary text and placeholders clear 4.5:1 on white
        slate: { 400: '#66768d' },
      },
      boxShadow: {
        soft: '0 1px 1px rgba(10,22,40,.03), 0 6px 18px -10px rgba(10,22,40,.10)',
        lift: '0 2px 6px rgba(10,22,40,.06), 0 22px 44px -14px rgba(10,22,40,.20)',
        glow: '0 4px 14px -4px rgba(12,125,118,.45)',
        ring: '0 0 0 4px rgba(23,170,158,.16)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        pop: { '0%': { opacity: 0, transform: 'scale(.96) translateY(8px)' }, '100%': { opacity: 1, transform: 'scale(1) translateY(0)' } },
        'slide-left': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        'slide-right': { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
        'toast-in': { '0%': { opacity: 0, transform: 'translateX(24px) scale(.96)' }, '100%': { opacity: 1, transform: 'translateX(0) scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        ping2: { '0%': { transform: 'scale(1)', opacity: 0.6 }, '100%': { transform: 'scale(2.4)', opacity: 0 } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        beat: { '0%,100%': { transform: 'scale(1)' }, '15%': { transform: 'scale(1.18)' }, '30%': { transform: 'scale(1)' }, '45%': { transform: 'scale(1.12)' } },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.2,.7,.2,1) both',
        'fade-in': 'fade-in .25s ease-out both',
        pop: 'pop .22s cubic-bezier(.2,.8,.2,1) both',
        'slide-left': 'slide-left .28s cubic-bezier(.2,.8,.2,1) both',
        'slide-right': 'slide-right .28s cubic-bezier(.2,.8,.2,1) both',
        'toast-in': 'toast-in .3s cubic-bezier(.2,.8,.2,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        ping2: 'ping2 1.6s cubic-bezier(0,0,.2,1) infinite',
        float: 'float 5s ease-in-out infinite',
        beat: 'beat 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
