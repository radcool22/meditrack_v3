/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          50:  'rgb(244, 255, 218)',
          100: 'rgb(232, 253, 190)',
          200: 'rgb(212, 248, 148)',
          400: 'rgb(199, 243, 108)',
          500: 'rgb(199, 243, 108)',
          600: 'rgb(160, 210, 70)',
          700: 'rgb(199, 243, 108)',
          900: 'rgb(72, 115, 10)',
          950: 'rgb(40, 70, 5)',
        },
        amber: {
          50:  'rgb(235, 243, 255)',
          100: 'rgb(219, 234, 254)',
          200: 'rgb(191, 219, 254)',
          400: 'rgb(52, 120, 247)',
          500: 'rgb(40, 96, 207)',
        },
        orange: {
          50:  'rgb(235, 243, 255)',
          100: 'rgb(219, 234, 254)',
          200: 'rgb(191, 219, 254)',
          500: 'rgb(52, 120, 247)',
        },
        coral: {
          500: 'rgb(52, 120, 247)',
        },
        accent: {
          500: 'rgb(52, 120, 247)',
          600: 'rgb(40, 96, 207)',
        },
        surface: '#ffffff',
        card:    '#ffffff',
        ink: {
          900: '#1a1a1a',
          600: '#4a4a4a',
          400: '#8a8a8a',
          200: '#e5e5e5',
        },
      },
      fontFamily: {
        sans:  ['Aileron', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
}
