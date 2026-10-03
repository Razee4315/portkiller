/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // System fonts only: nothing is bundled or fetched, so the stack
        // names what Windows actually has. Mono is for ports, PIDs and paths.
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Cascadia Mono', 'Consolas', 'monospace'],
      },
      colors: {
        // Softer, slightly warm-neutral surfaces — easier on the eye than pure
        // black, still feels like a developer tool.
        dark: {
          900: '#0d0e11',
          800: '#14161b',
          700: '#1c1f25',
          600: '#252932',
          500: '#2f343f',
        },
        accent: {
          green: '#22c55e',
          red: '#ef4444',
          blue: '#60a5fa',
          yellow: '#eab308',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
