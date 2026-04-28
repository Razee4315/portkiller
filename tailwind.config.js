/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // UI chrome: clean sans-serif. Mono is reserved for ports/PIDs/paths.
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
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
          amber: '#f59e0b',
        }
      },
      animation: {
        'shake': 'shake 0.5s ease-in-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
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
