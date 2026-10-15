/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.tsx', './components/**/*.tsx', './hooks/**/*.ts', './services/**/*.ts'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(190, 80%, 45%)',
          light: 'hsl(190, 80%, 60%)',
          dark: 'hsl(190, 80%, 35%)',
        },
        secondary: {
          DEFAULT: 'hsl(38, 92%, 50%)',
          light: 'hsl(38, 92%, 65%)',
          dark: 'hsl(38, 92%, 40%)',
        },
        accent: {
          DEFAULT: 'hsl(210, 90%, 55%)',
          light: 'hsl(210, 90%, 65%)',
          dark: 'hsl(210, 90%, 45%)',
        },
      },
    },
  },
  plugins: [],
};
