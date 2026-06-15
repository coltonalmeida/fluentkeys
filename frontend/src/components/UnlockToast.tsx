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
      className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-lg border border-emerald-500/40 bg-white/95 px-5 py-3 text-center shadow-xl dark:bg-zinc-900/95"
    >
      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        🔓 New key unlocked: {letter.toUpperCase()}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Keep it up — {remaining} {remaining === 1 ? 'letter' : 'letters'} to go
      </p>
    </motion.div>
  )
}
