import { motion } from 'framer-motion'
import { achievementLabel } from '../lib/achievements'

/** Top-center toast when one or more achievements are earned. Mirrors UnlockToast. */
export function AchievementToast({ keys }: { keys: string[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-lg border border-accent/40 bg-surface/95 px-5 py-3 text-center shadow-xl"
    >
      <p className="text-sm font-semibold text-accent">🏅 Achievement unlocked</p>
      <p className="text-xs text-muted">{keys.map(achievementLabel).join(' · ')}</p>
    </motion.div>
  )
}
