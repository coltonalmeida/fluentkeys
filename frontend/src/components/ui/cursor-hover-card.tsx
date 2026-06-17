import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'

interface CursorHoverCardProps {
  /** Whether the preview is visible (e.g. a watched element is hovered). */
  open: boolean
  children: ReactNode
}

/** Gap between the cursor and the card's bottom edge. */
const OFFSET_Y = 26
/** Fallback card size used until the real element is measured. */
const FALLBACK_W = 224
const FALLBACK_H = 88

/**
 * A hover preview that follows the cursor — a blend of two patterns: the
 * cursor-follow morph-in-from-a-dot feel (spring follow + scale/opacity entrance)
 * and the hover-link-preview rich card that tilts with horizontal movement. It
 * renders `fixed` and `pointer-events-none`, so it sits above and coexists with
 * the app's own cursor rather than replacing it. Pointer position is tracked via
 * motion values (no React re-render per move).
 */
export function CursorHoverCard({ open, children }: CursorHoverCardProps) {
  const left = useMotionValue(0)
  const top = useMotionValue(0)
  const rotate = useMotionValue(0)
  const springLeft = useSpring(left, { stiffness: 350, damping: 40 })
  const springTop = useSpring(top, { stiffness: 350, damping: 40 })
  const springRotate = useSpring(rotate, { stiffness: 300, damping: 20 })
  const prevX = useRef<number | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Track the pointer continuously so the card is already positioned when it
  // opens (no flash from a stale origin).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const w = cardRef.current?.offsetWidth ?? FALLBACK_W
      const h = cardRef.current?.offsetHeight ?? FALLBACK_H
      left.set(e.clientX - w / 2)
      top.set(e.clientY - h - OFFSET_Y)
      if (prevX.current !== null) {
        const dx = e.clientX - prevX.current
        rotate.set(Math.max(-15, Math.min(15, dx * 1.2)))
      }
      prevX.current = e.clientX
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [left, top, rotate])

  // Settle the tilt back to flat between hovers.
  useEffect(() => {
    if (!open) {
      prevX.current = null
      rotate.set(0)
    }
  }, [open, rotate])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.3, ease: 'easeInOut' } }}
          exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.18 } }}
          style={{
            position: 'fixed',
            left: springLeft,
            top: springTop,
            rotate: springRotate,
            zIndex: 60,
            pointerEvents: 'none',
          }}
          className="w-56 rounded-xl border border-border bg-surface/95 p-3 text-left shadow-xl backdrop-blur"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
