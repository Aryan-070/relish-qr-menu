import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// NOTE: StrictMode intentionally omitted. Its dev-only double-mount made
// framer-motion enter animations (screen fades, bottom sheets sliding up)
// intermittently stick at their `initial` state in the dev server — a known
// React 18 + framer-motion interaction that does not occur in production.
// Removing it makes the dev preview behave like the production build.
createRoot(document.getElementById('root')!).render(<App />)

// PWA: register the hand-rolled service worker for offline support.
// Guarded to production only so the dev server (HMR) is never disrupted by a
// stale cache, and wrapped so any failure is a silent no-op.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
