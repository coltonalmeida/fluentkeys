import { motion } from 'framer-motion'

/** Top-center toast shown when a result/session pushes the user to a new level. */
export function LevelUpToast({ level }: { level: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-lg border border-accent/40 bg-surface/95 px-5 py-3 text-center shadow-xl"
    >
      <p className="text-sm font-semibold text-accent">⭐ Level up!</p>
      <p className="text-xs text-muted">You reached level {level}</p>
    </motion.div>
  )
}
