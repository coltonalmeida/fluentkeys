import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { Trace } from '../lib/api'
import type { CharState } from '../hooks/useTypingTest'
import { KeyHeatmap } from './KeyHeatmap'
import { TypingArea } from './TypingArea'

/** Frame-by-frame replay of a finished test (§27) shown as a modal. Reuses
 *  TypingArea so the caret keeps its plain CSS-transform motion (no JS lib). */
export function ReplayPlayer({ trace, onClose }: { trace: Trace; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [charStates, setCharStates] = useState<CharState[]>([])
  const [playToken, setPlayToken] = useState(0)
  const [done, setDone] = useState(false)

  // Re-run the trace whenever playToken changes (initial mount + replay button).
  useEffect(() => {
    let raf = 0
    let i = 0
    let idx = 0
    const states: CharState[] = []
    const start = performance.now()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset playback to the start on (re)play
    setIndex(0)
    setCharStates([])
    setDone(false)

    const tick = (now: number) => {
      const elapsed = now - start
      let changed = false
      while (i < trace.events.length && trace.events[i]!.t <= elapsed) {
        const e = trace.events[i]!
        i += 1
        if (e.ch === '\b') {
          if (idx > 0) {
            idx -= 1
            states.pop()
          }
        } else {
          states[idx] = e.ok ? 'correct' : 'incorrect'
          idx += 1
        }
        changed = true
      }
      if (changed) {
        setIndex(idx)
        setCharStates([...states])
      }
      if (i < trace.events.length) {
        raf = requestAnimationFrame(tick)
      } else {
        setDone(true)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [trace, playToken])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-fg">Replay</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-fg">
            Close
          </button>
        </div>

        {/* onKey is a no-op — playback is driven by the trace. */}
        <TypingArea target={trace.target} charStates={charStates} index={index} onKey={() => {}} />

        <div className="flex flex-col items-center gap-3">
          <KeyHeatmap trace={trace} />
          {done && (
            <button
              type="button"
              onClick={() => setPlayToken((n) => n + 1)}
              className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast hover:bg-accent/90"
            >
              Replay again
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
