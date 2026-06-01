/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FFF8EA',
        'paper-2': '#F7EBD2',
        ink: '#2A1E1E',
        'ink-soft': '#5b4a44',
        maroon: '#8B1024',
        red: '#D71920',
        gold: '#D9A03A',
        olive: '#4F7A3C',
        mute: '#a89a8a',
      },
      fontFamily: {
        playfair: ['"Playfair Display"', 'Georgia', 'serif'],
        cormorant: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        inter: ['Inter', 'system-ui', 'sans-serif'],
        caveat: ['Caveat', 'cursive'],
      },
      zIndex: {
        60: '60',
      },
      spacing: {
        'rs-1': '4px', 'rs-2': '8px', 'rs-3': '12px', 'rs-4': '16px',
        'rs-5': '20px', 'rs-6': '24px', 'rs-8': '32px', 'rs-10': '40px', 'rs-12': '48px',
      },
      borderRadius: {
        'rs-sm': '6px', 'rs-md': '8px', 'rs-lg': '12px', 'rs-xl': '16px', 'rs-2xl': '24px',
      },
      fontSize: {
        // Display & headings carry negative tracking so large serif/sans hold
        // together; body keeps generous line-height for readability.
        'rs-display': ['28px', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        'rs-title': ['21px', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        'rs-heading': ['18px', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'rs-body': ['14px', { lineHeight: '1.55' }],
        'rs-secondary': ['13px', { lineHeight: '1.6' }],
        'rs-caption': ['11px', { lineHeight: '1.6' }],
        'rs-label': ['10px', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        'rs-micro': ['8px', { lineHeight: '1.3', letterSpacing: '0.04em' }],
      },
      boxShadow: {
        booklet: '0 8px 40px rgba(42,30,30,0.12), 0 2px 8px rgba(42,30,30,0.08)',
        card: '0 2px 12px rgba(42,30,30,0.08)',
        sheet: '0 -4px 32px rgba(42,30,30,0.16)',
        'rs-1': '0 1px 4px rgba(42,30,30,0.06)',
        'rs-2': '0 2px 12px rgba(42,30,30,0.08)',
        'rs-3': '0 4px 20px rgba(42,30,30,0.10)',
      },
    },
  },
  plugins: [],
}
