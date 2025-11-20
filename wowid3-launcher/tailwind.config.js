/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        christmas: {
          red: '#C41E3A',
          green: '#0F8A5F',
          gold: '#FFD700',
          darkBg: '#1a0f0f',
          snow: '#FFFFFF',
        },
      },
      fontFamily: {
        heading: ['Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'sans-serif'],
        body: ['Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'sans-serif'],
        mono: ['Courier New', 'Courier', 'monospace'],
      },
      fontSize: {
        'h1': ['2.25rem', { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '800' }],
        'h2': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '700' }],
        'h3': ['1.5rem', { lineHeight: '1.5', fontWeight: '700' }],
        'h4': ['1.25rem', { lineHeight: '1.5', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body': ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
        'small': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }],
      },
      animation: {
        'snow-fall': 'snowfall 10s linear infinite',
        'twinkle': 'twinkle 2s ease-in-out infinite',
        'fade-in': 'fadeIn 200ms ease-in-out',
        'fade-out': 'fadeOut 200ms ease-in-out',
        'slide-in': 'slideIn 200ms ease-out',
        'slide-out': 'slideOut 200ms ease-in',
      },
      keyframes: {
        snowfall: {
          '0%': { transform: 'translateY(-10vh)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideOut: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-10px)', opacity: '0' },
        },
      },
      transitionDuration: {
        'fast': '150ms',
        'base': '200ms',
        'slow': '300ms',
        'slower': '500ms',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        base: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
