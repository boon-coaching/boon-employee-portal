/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        boon: {
          // Primary
          blue: '#466FF6',
          darkBlue: '#365ABD',
          lightBlue: '#CCD9FF',

          // Coral / warmth accent
          coral: '#FF6D6A',
          coralLight: '#FF8D80',
          coralSoft: '#FFBBBB',
          lightCoral: '#FFE8E8', // legacy, keep for existing usage
          darkCoral: '#E55555',  // legacy, keep for existing usage

          // Navy / authority surfaces
          navy: '#1A253B',
          navyDeep: '#111A2B',

          // Neutrals
          charcoal: '#2E353D',
          offWhite: '#F0F3F7',

          // Legacy neutrals — kept for existing usage, prefer charcoal / offWhite
          bg: '#F8F9FC',
          text: '#1A1F36',

          // Success / caution
          green: '#6CD893',
          amber: '#D97706',
          amberLight: '#FEF3C7',
          amberDark: '#B45309',
        }
      },
      fontFamily: {
        // Body default stays Inter
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Display headlines
        display: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
        // Italic serif kicker (the signature Boon emphasis treatment)
        serif: ['"DM Serif Text"', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      borderRadius: {
        // Boon UI radius tokens — always slightly rounded
        card: '10px',
        btn: '8px',
        pill: '999px',
      },
    },
  },
  plugins: [],
}
