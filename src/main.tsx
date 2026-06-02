import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// NOTE: StrictMode intentionally omitted. Its dev-only double-mount made
// framer-motion enter animations (screen fades, bottom sheets sliding up)
// intermittently stick at their `initial` state in the dev server — a known
// React 18 + framer-motion interaction that does not occur in production.
// Removing it makes the dev preview behave like the production build.
createRoot(document.getElementById('root')!).render(<App />)
