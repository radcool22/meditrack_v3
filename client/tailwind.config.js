/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          lime:     '#bbf451',
          'lime-dark': '#a6db46',
          black:    '#181818',
          gray:     '#8e8e8e',
          border:   '#e0e0e0',
          surface:  '#f5f5f5',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
}
