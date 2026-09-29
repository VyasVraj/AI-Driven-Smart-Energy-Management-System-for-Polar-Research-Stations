/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'sans-serif'],
        heading: ['Space Grotesk', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        pg: {
          bg:       '#0A0F1A',
          panel:    '#101827',
          raised:   '#141E2E',
          dark:     '#0D1523',
          border:   '#1E293B',
          'border-dim': '#162032',
          hover:    '#1A2540',
          text:     '#E2E8F0',
          muted:    '#94A3B8',
          dim:      '#475569',
          faint:    '#334155',
          cyan:     '#06B6D4',
          green:    '#10B981',
          amber:    '#F59E0B',
          red:      '#EF4444',
          purple:   '#8B5CF6',
        },
      },
      animation: {
        'dot-drift':  'dotDrift 80s linear infinite',
        'flow-dash':  'flowDash 1.6s linear infinite',
        'spin-slow':  'spinSlow 12s linear infinite',
        'pulse-dot':  'pulseDot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
