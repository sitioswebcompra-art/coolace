/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { dark: '#0f172a', blue: '#2563eb', electric: '#3b82f6', light: '#f1f5f9', white: '#ffffff' },
        status: { pending: '#eab308', assigned: '#3b82f6', process: '#f97316', completed: '#22c55e', cancelled: '#ef4444' }
      }
    },
  },
  plugins: [],
}