/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        surface: {
          0: '#06080d',
          1: '#0c1017',
          2: '#12161f',
          3: '#1a1f2b',
          4: '#232938',
        },
        border: {
          subtle: '#1a1f2b',
          DEFAULT: '#252b3b',
          strong: '#343c50',
        },
        accent: {
          DEFAULT: '#e8a23e',
          dim: 'rgba(232, 162, 62, 0.10)',
          medium: 'rgba(232, 162, 62, 0.20)',
        },
        live: {
          DEFAULT: '#3fb950',
          dim: 'rgba(63, 185, 80, 0.12)',
          glow: 'rgba(63, 185, 80, 0.40)',
        },
        data: {
          blue: '#58a6ff',
          'blue-dim': 'rgba(88, 166, 255, 0.12)',
          purple: '#bc8cff',
          'purple-dim': 'rgba(188, 140, 255, 0.12)',
          cyan: '#56d4dd',
          'cyan-dim': 'rgba(86, 212, 221, 0.12)',
        },
        danger: {
          DEFAULT: '#f85149',
          dim: 'rgba(248, 81, 73, 0.12)',
        },
        warn: {
          DEFAULT: '#d29922',
          dim: 'rgba(210, 153, 34, 0.12)',
        },
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'dot-pulse': {
          '0%, 100%': { boxShadow: '0 0 4px 1px var(--tw-shadow-color)' },
          '50%': { boxShadow: '0 0 8px 3px var(--tw-shadow-color)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'ring-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'fade-in-delay': 'fade-in 0.4s ease-out 0.1s both',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'dot-pulse': 'dot-pulse 2s ease-in-out infinite',
        shimmer: 'shimmer 3s ease-in-out infinite',
        'ring-pulse': 'ring-pulse 2s ease-out infinite',
      },
    },
  },
  plugins: [],
};
