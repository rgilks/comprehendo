/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      screens: {
        xs: '480px',
      },
      keyframes: {
        scaleUp: {
          '0%': { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
      animation: {
        'scale-up': 'scaleUp 0.3s ease-out forwards',
      },
      animationDelay: {
        200: '0.2s',
        300: '0.3s',
      },
    },
  },
  plugins: [],
};

export default config;
