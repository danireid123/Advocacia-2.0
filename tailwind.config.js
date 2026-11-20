/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        'gold-primary': '#d4af37',
        'gold-soft': '#f3dc8a',
        amber: {
          400: '#f3dc8a',
          500: '#d4af37',
          600: '#b89228'
        }
      }
    }
  },
  plugins: []
};
