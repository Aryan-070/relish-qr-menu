import { motion } from 'framer-motion'

export function DrizzleAnim() {
  return (
    <div
      className="absolute right-4 top-0 pointer-events-none"
      style={{ width: 40, height: 80, zIndex: 0 }}
      aria-hidden
    >
      <svg viewBox="0 0 40 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <motion.path
          d="M20 0 C24 10 16 18 20 28 C24 38 14 46 20 56 C26 66 18 72 20 80"
          stroke="#D9A03A"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 1, 1, 0],
            opacity:    [0, 0.9, 0.9, 0],
          }}
          transition={{
            duration: 3.2,
            times: [0, 0.58, 0.82, 1],
            repeat: Infinity,
            repeatDelay: 0.6,
            ease: 'easeInOut',
          }}
        />
        <motion.circle
          cx="20" cy="80" r="3"
          fill="#D9A03A"
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0.7, 0],
            scale:   [0, 1, 0.3],
          }}
          transition={{
            duration: 3.2,
            times: [0.56, 0.75, 1],
            repeat: Infinity,
            repeatDelay: 0.6,
          }}
        />
      </svg>
    </div>
  )
}
