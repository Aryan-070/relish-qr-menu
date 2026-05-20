import { motion } from 'framer-motion'

export function SwirlAnim() {
  return (
    <div
      className="absolute right-2 top-1 pointer-events-none"
      style={{ width: 60, height: 60, zIndex: 0 }}
      aria-hidden
    >
      <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <motion.path
          d="M30 10 C50 10 55 30 40 38 C25 46 10 36 16 24 C22 12 42 14 44 28 C46 42 34 50 24 44"
          stroke="#D9A03A"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 1, 1, 0],
            opacity:    [0, 0.7, 0.7, 0],
          }}
          transition={{
            duration: 4.0,
            times: [0, 0.60, 0.82, 1],
            repeat: Infinity,
            repeatDelay: 0.8,
            ease: 'easeInOut',
          }}
        />
      </svg>
    </div>
  )
}
