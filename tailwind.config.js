/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ton: {
          blue: '#0098EA',
          cyan: '#2ED3FF',
        },
      },
      boxShadow: {
        glow: '0 0 32px rgba(0, 152, 234, 0.24)',
        card: '0 18px 60px rgba(0, 0, 0, 0.32)',
      },
    },
  },
  plugins: [],
};
