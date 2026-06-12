import { motion } from 'framer-motion'

/**
 * Box lid overlaying the real practice keyboard on page load. It lifts
 * away in place — the keyboard underneath never unmounts, and the rest
 * of the UI bleeds in around it (handled in App).
 */
export function BoxLid({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      className="absolute -inset-3 z-10 rounded-2xl"
      style={{
        background: 'linear-gradient(160deg, #a8845c, #8a6b48)',
        boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
      }}
      initial={{ y: 0, rotate: 0, opacity: 1 }}
      animate={{ y: -280, rotate: -8, opacity: 0 }}
      transition={{ duration: 0.9, delay: 0.6, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={onDone}
    >
      {/* lid flap seam */}
      <div className="absolute inset-x-6 top-1/2 h-px bg-black/20" />
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
        <span className="text-lg font-bold tracking-widest text-black/30">FLUENTKEYS</span>
      </div>
    </motion.div>
  )
}
