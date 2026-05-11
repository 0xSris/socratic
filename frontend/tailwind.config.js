/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif:   ['var(--font-serif)', 'Georgia', 'serif'],
        sans:    ['var(--font-sans)', 'system-ui'],
        mono:    ['var(--font-mono)', 'monospace'],
      },
      colors: {
        void:    '#080b12',
        cosmos:  '#0d1220',
        nebula:  '#111827',
        ion:     '#6366f1',
        'ion-bright': '#818cf8',
        'ion-dim':    '#3730a3',
        aurora:  '#22d3ee',
        'aurora-dim': '#0e7490',
        ember:   '#f59e0b',
        ghost:   'rgba(255,255,255,0.06)',
        'ghost-border': 'rgba(255,255,255,0.08)',
      },
      animation: {
        'pulse-slow':  'pulse 4s ease-in-out infinite',
        'fade-in':     'fadeIn 0.5s ease-out forwards',
        'slide-up':    'slideUp 0.4s ease-out forwards',
        'glow-pulse':  'glowPulse 3s ease-in-out infinite',
        'float':       'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        glowPulse: { '0%,100%': { opacity: 0.6 }, '50%': { opacity: 1 } },
        float:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
    },
  },
  plugins: [],
}
