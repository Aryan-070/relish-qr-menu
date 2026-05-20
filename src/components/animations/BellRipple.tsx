import { useState } from 'react'
import { Bell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface BellRippleProps {
  size?: number
  color?: string
  onClick?: () => void
}

export function BellRipple({ size = 20, color = '#D9A03A', onClick }: BellRippleProps) {
  const [ringing, setRinging] = useState(false)

  const handleClick = () => {
    setRinging(true)
    setTimeout(() => setRinging(false), 1400)
    onClick?.()
  }

  return (
    <motion.div
      className="relative flex items-center justify-center cursor-pointer select-none"
      style={{ width: size * 2, height: size * 2 }}
      onClick={handleClick}
      animate={ringing ? { rotate: [0, 10, -10, 6, -6, 3, -3, 0] } : { rotate: 0 }}
      transition={{ duration: 0.7, ease: 'easeInOut' }}
    >
      <AnimatePresence>
        {ringing && (
          <>
            {[0, 0.15, 0.3].map((delay, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: size * 2,
                  height: size * 2,
                  border: `2px solid ${color}`,
                }}
                initial={{ scale: 0.5, opacity: 0.8 }}
                animate={{ scale: 3.5, opacity: 0 }}
                exit={{}}
                transition={{ duration: 0.9, delay, ease: 'easeOut' }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
      <Bell size={size} color={color} strokeWidth={1.8} />
    </motion.div>
  )
}
