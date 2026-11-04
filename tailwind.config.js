/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Qalam brand: a deep ink-teal with a warm gold accent.
        brand: {
          50: '#effaf8', 100: '#d6f2ed', 200: '#ade4da', 300: '#7ccfc3', 400: '#48b2a6',
          500: '#27968b', 600: '#1b7a72', 700: '#18625d', 800: '#174f4b', 900: '#15403e', 950: '#072625',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        lift: '0 10px 30px -10px rgba(7, 38, 37, 0.25)',
      },
    },
  },
  plugins: [],
}
