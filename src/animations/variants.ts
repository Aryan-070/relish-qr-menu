import type { Variants } from 'framer-motion'

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 28 },
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 380, damping: 26 },
  },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.15 } },
}

// Category page transitions. With AnimatePresence in default (sync) mode the
// entering page slides in over the leaving page, which fades out in place —
// so there is never a blank frame (the old mode="wait" + x-exit left a ~280ms gap).
export const slideLeft: Variants = {
  hidden: { opacity: 0, x: 60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 260, damping: 30 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 0.6, 1] },
  },
}

export const slideRight: Variants = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 260, damping: 30 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 0.6, 1] },
  },
}

export const orderSlip: Variants = {
  hidden: { y: 80, opacity: 0, scale: 0.95 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 340,
      damping: 24,
      delay: 0.15,
    },
  },
}

export const checkmark: Variants = {
  hidden: { scale: 0, opacity: 0, rotate: -20 },
  visible: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 22,
      delay: 0.4,
    },
  },
}

export const questionReveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 280, damping: 26 },
  },
  exit: { opacity: 0, y: -12, transition: { duration: 0.18 } },
}

export const fullPanel: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35 } },
  exit: { opacity: 0, transition: { duration: 0.25 } },
}

// ── 2025 trending mobile button press variants ──────────────────────────────
// Use with whileTap / whileHover — not with the `variants` prop.

export const btnPrimary = {
  tap:   { scale: 0.955, y: 3, transition: { type: 'spring' as const, stiffness: 400, damping: 20 } },
  hover: { scale: 1.015, transition: { type: 'spring' as const, stiffness: 300, damping: 22 } },
}

export const btnCard = {
  tap:   { scale: 0.935, y: 2, transition: { type: 'spring' as const, stiffness: 350, damping: 22 } },
  hover: { scale: 1.02,  transition: { type: 'spring' as const, stiffness: 280, damping: 24 } },
}

export const btnIcon = {
  tap: { scale: 0.84, rotate: 8, transition: { type: 'spring' as const, stiffness: 500, damping: 28 } },
}

export const btnStep = {
  tap: { scale: 0.78, transition: { type: 'spring' as const, stiffness: 600, damping: 22 } },
}
