import { motion } from 'framer-motion'
import { KeyboardVisual } from './KeyboardVisual'

/**
 * Page-load intro: the keyboard sits in a box and the lid lifts away,
 * then the rest of the UI loads in around the keyboard (handled by App).
 */
export function Unboxing({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="relative">
        <KeyboardVisual nextChar={null} flashKeyId={null} showInfo={false} />
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
      </div>
    </div>
  )
}
