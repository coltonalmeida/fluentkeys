import { motion } from 'framer-motion'

interface UnlockToastProps {
  letter: string
  /** How many letters remain locked. */
  remaining: number
}

/** Top-center, non-blocking unlock notification (spec §6.5). Shown for 3s. */
export function UnlockToast({ letter, remaining }: UnlockToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-lg border border-accent/40 bg-surface/95 px-5 py-3 text-center shadow-xl"
    >
      <p className="text-sm font-semibold text-accent">
        🔓 New key unlocked: {letter.toUpperCase()}
      </p>
      <p className="text-xs text-muted">
        Keep it up — {remaining} {remaining === 1 ? 'letter' : 'letters'} to go
      </p>
    </motion.div>
  )
}
