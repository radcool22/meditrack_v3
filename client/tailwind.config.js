/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // MediTrack design system
        teal: {
          50:  'rgb(244, 255, 218)',   // very light lime — icon backgrounds
          100: 'rgb(232, 253, 190)',   // light lime — badge backgrounds
          200: 'rgb(212, 248, 148)',   // medium-light lime — borders
          400: 'rgb(199, 243, 108)',   // primary lime — gradient ends
          500: 'rgb(199, 243, 108)',   // primary lime — border accents, dots
          600: 'rgb(160, 210, 70)',    // darker lime — hover states
          700: 'rgb(199, 243, 108)',   // primary lime — main buttons, brand
          900: 'rgb(72, 115, 10)',     // dark lime — header backgrounds
          950: 'rgb(40, 70, 5)',       // very dark lime
        },
        // Orange / coral / amber all map to blue accent
        amber: {
          50:  'rgb(235, 243, 255)',   // light blue bg
          100: 'rgb(219, 234, 254)',   // light blue — badge backgrounds
          200: 'rgb(191, 219, 254)',   // medium blue — borders
          400: 'rgb(52, 120, 247)',    // primary blue
          500: 'rgb(40, 96, 207)',     // hover blue
        },
        orange: {
          50:  'rgb(235, 243, 255)',   // light blue bg
          100: 'rgb(219, 234, 254)',   // light blue
          200: 'rgb(191, 219, 254)',   // medium blue
          500: 'rgb(52, 120, 247)',    // primary blue
        },
        coral: {
          500: 'rgb(52, 120, 247)',    // primary blue
        },
        // Explicit accent tokens for the exact required RGB values
        accent: {
          500: 'rgb(52, 120, 247)',    // primary blue accent
          600: 'rgb(40, 96, 207)',     // hover blue accent
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
