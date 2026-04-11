/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy brand colors (kept for backward compat)
        brand: {
          lime:       '#bbf451',
          'lime-dark':'#a6db46',
          black:      '#181818',
          gray:       '#8e8e8e',
          border:     '#e0e0e0',
          surface:    '#f5f5f5',
        },
        // New MediTrack design system
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          900: '#134e4a',
          950: '#0d2d2a',
        },
        amber: {
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
        },
        coral: {
          500: '#f97316',
        },
        surface: '#fafaf9',
        card:    '#ffffff',
        ink: {
          900: '#1a1a1a',
          600: '#4a4a4a',
          400: '#8a8a8a',
          200: '#e5e5e5',
        },
      },
      fontFamily: {
        sans:  ['Plus Jakarta Sans', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
}
