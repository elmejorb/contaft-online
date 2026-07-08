/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta Conta FT — misma del desktop para consistencia de marca
        // cuando el usuario migre.
        primary: {
          50:  '#f3e8ff',
          100: '#e9d5ff',
          500: '#7c3aed',
          600: '#7c3aed',
          700: '#6d28d9',
        },
      },
    },
  },
  plugins: [],
};
