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
      boxShadow: {
        booklet: '0 8px 40px rgba(42,30,30,0.12), 0 2px 8px rgba(42,30,30,0.08)',
        card: '0 2px 12px rgba(42,30,30,0.08)',
        sheet: '0 -4px 32px rgba(42,30,30,0.16)',
      },
    },
  },
  plugins: [],
}
