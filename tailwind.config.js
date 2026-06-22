/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 和风配色
        indigo: {
          900: '#1a365d', // 深靛蓝 - 主色
        },
        cream: {
          50: '#faf5eb',  // 米白 - 辅色
        },
        sakura: {
          400: '#f0a5b8', // 樱粉 - 强调色
        },
        ink: {
          900: '#1a1a1a', // 墨黑
          700: '#4a5568', // 灰色
        }
      },
      fontFamily: {
        'noto-serif': ['Noto Serif JP', 'serif'],
        'noto-sans': ['Noto Sans JP', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'bounce-correct': 'bounce-correct 0.3s ease-out',
        'shake-error': 'shake-error 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'fadeIn': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        'bounce-correct': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'shake-error': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fadeIn': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
