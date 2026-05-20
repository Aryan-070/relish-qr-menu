import { motion } from 'framer-motion'

export function PlateAnim() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden
    >
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            width: 130 + i * 18,
            height: 130 + i * 18,
            top: -38 - i * 8,
            right: -38 - i * 8,
          }}
          initial={{ opacity: 0, scale: 0.55 }}
          animate={{
            opacity: [0, 0.07 - i * 0.018, 0],
            scale: [0.55, 1.5, 1.5],
          }}
          transition={{
            duration: 3.8,
            delay: i * 0.55,
            repeat: Infinity,
            repeatDelay: 1.8,
            ease: 'easeOut',
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(217,160,58,0.95)" strokeWidth="2" />
            <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(217,160,58,0.85)" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="24" fill="rgba(217,160,58,0.28)" />
          </svg>
        </motion.div>
      ))}
    </div>
  )
}
