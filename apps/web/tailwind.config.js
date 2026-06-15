/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 28px rgba(0, 152, 234, 0.32)',
        card: '0 20px 80px rgba(0, 0, 0, 0.32)',
      },
    },
  },
  plugins: [],
};
