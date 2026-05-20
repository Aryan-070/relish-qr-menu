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

export const staggerSlow: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14 } },
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

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: 60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 260, damping: 30 },
  },
  exit: {
    opacity: 0,
    x: -60,
    transition: { ease: [0.4, 0, 0.6, 1], duration: 0.28 },
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
    x: 60,
    transition: { ease: [0.4, 0, 0.6, 1], duration: 0.28 },
  },
}

export const bottomSheet: Variants = {
  hidden: { y: '100%', opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 260, damping: 28 },
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { ease: [0.4, 0, 0.6, 1], duration: 0.32 },
  },
}

export const bottomPanel: Variants = {
  hidden: { y: '100%', opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 320, damping: 30 },
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { ease: [0.4, 0, 0.6, 1], duration: 0.24 },
  },
}

export const chipTap = {
  whileTap: { scale: 0.93 },
  transition: { type: 'spring', stiffness: 500, damping: 20 },
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

export const resultCard: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 280,
      damping: 26,
      delay: i * 0.1,
    },
  }),
}

export const coverLogo: Variants = {
  hidden: { opacity: 0, y: -20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
}

export const coverCTA: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: 0.8 + i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
}
