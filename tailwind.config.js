/** @type {import('tailwindcss').Config} */
//
// Boon tokens are sourced from ../boon-design-system/tokens/colors.css
// and spacing.css, imported into src/index.css. This config maps the CSS
// variables to Tailwind utility classes so bg-boon-blue, rounded-card,
// font-display, etc. all resolve against the canonical tokens. Do not
// hardcode hex values here (design system rule #4).
//
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        boon: {
          // Primary blue
          blue: 'var(--boon-blue)',
          darkBlue: 'var(--boon-blue-dark)',
          lightBlue: 'var(--boon-blue-light)',

          // Coral / warmth accent
          coral: 'var(--boon-coral)',
          coralLight: 'var(--boon-coral-light)',
          coralSoft: 'var(--boon-coral-soft)',

          // Navy / authority surfaces
          navy: 'var(--boon-navy)',
          navyDeep: 'var(--boon-navy-deep)',

          // Neutrals
          charcoal: 'var(--boon-charcoal)',
          offWhite: 'var(--boon-off-white)',

          // Data viz accent palette
          purple: 'var(--boon-purple)',
          gold: 'var(--boon-gold)',
          green: 'var(--boon-green)',

          // Product colors (SCALE / GROW / EXEC / TOGETHER / ADAPT)
          scale: 'var(--boon-product-scale)',
          grow: 'var(--boon-product-grow)',
          exec: 'var(--boon-product-exec)',
          together: 'var(--boon-product-together)',
          adapt: 'var(--boon-product-adapt)',

          // Status / system feedback
          success: 'var(--boon-success)',
          warning: 'var(--boon-warning)',
          error: 'var(--boon-error)',

          // Legacy aliases (existing portal usage; prefer canonical tokens above)
          bg: 'var(--boon-bg-legacy)',
          text: 'var(--boon-text-legacy)',
          lightCoral: 'var(--boon-coral-legacy-light)',
          darkCoral: 'var(--boon-coral-legacy-dark)',
          amber: 'var(--boon-warning)',
          amberLight: 'var(--boon-warning-light)',
          amberDark: 'var(--boon-warning-dark)',
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
        btn: 'var(--radius-btn)',
        card: 'var(--radius-card)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}
