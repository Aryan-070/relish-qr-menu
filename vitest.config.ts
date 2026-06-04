import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The React plugin gives component tests JSX/automatic-runtime transforms,
  // matching how the app itself is built.
  plugins: [react()],
  test: {
    // jsdom (not 'node') so React component tests can mount and query the DOM.
    environment: 'jsdom',
    globals: true,
    // Pick up both pure-logic (.test.ts) and component (.test.tsx) suites.
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
