import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { TestStats, WpmSample } from '../lib/stats'
import { SaveProgressCta } from './SaveProgressCta'
import { TroubleKeys } from './TroubleKeys'
import { WpmChart } from './WpmChart'

interface ResultsScreenProps {
  stats: TestStats
  timeline?: WpmSample[]
  missCounts?: Record<string, number>
  /** Quote author(s) when the test was a quote — shown as attribution. */
  attribution?: string | null
  onRestart: () => void
  isPersonalBest?: boolean
}

// Framer Motion is allowed here — results screen and leaderboard only.
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 24, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 260, damping: 22 },
  },
}

/** Counts up from 0 to the target value as the screen animates in. */
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 800
    const start = performance.now()
    let frame: number
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(value * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <>{display.toFixed(decimals)}</>
}

export function ResultsScreen({
  stats,
  timeline = [],
  missCounts = {},
  attribution = null,
  onRestart,
  isPersonalBest = false,
}: ResultsScreenProps) {
  const hasTrouble = Object.values(missCounts).some((n) => n > 0)
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center gap-8 rounded-lg bg-surface p-10"
    >
      <motion.h2 variants={item} className="text-xl font-semibold text-fg">
        Test complete
      </motion.h2>

      {isPersonalBest && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.5 }}
          className="rounded-full bg-accent/15 px-4 py-1 text-sm font-semibold text-accent"
        >
          🏆 New personal best!
        </motion.div>
      )}

      <div className="flex flex-wrap justify-center gap-12 text-center">
        <motion.div variants={item}>
          <div className="text-6xl font-bold text-accent">
            <AnimatedNumber value={stats.wpm} />
          </div>
          <div className="mt-1 text-sm uppercase tracking-wider text-muted">WPM</div>
        </motion.div>
        <motion.div variants={item}>
          <div className="text-6xl font-bold text-fg">
            <AnimatedNumber value={stats.accuracy} decimals={1} />%
          </div>
          <div className="mt-1 text-sm uppercase tracking-wider text-muted">Accuracy</div>
        </motion.div>
        <motion.div variants={item}>
          <div className="text-6xl font-bold text-muted">
            <AnimatedNumber value={stats.rawWpm} />
          </div>
          <div className="mt-1 text-sm uppercase tracking-wider text-muted">Raw WPM</div>
        </motion.div>
      </div>

      <motion.div
        variants={item}
        className="flex gap-8 text-sm text-muted"
      >
        <span>
          <span className="text-fg">{stats.correctChars}</span> correct chars
        </span>
        <span>
          <span className="text-error">{stats.incorrectChars}</span> mistakes
        </span>
        <span>
          <span className="text-fg">{stats.totalKeystrokes}</span> keystrokes
        </span>
      </motion.div>

      {attribution && (
        <motion.div variants={item} className="text-sm italic text-muted">
          — {attribution}
        </motion.div>
      )}

      {hasTrouble && (
        <motion.div variants={item} className="flex flex-col items-center gap-2">
          <div className="text-xs uppercase tracking-wider text-muted">Trouble keys</div>
          <TroubleKeys counts={missCounts} />
        </motion.div>
      )}

      {timeline.length >= 2 && (
        <motion.div variants={item} className="flex w-full flex-col items-center gap-2">
          <WpmChart samples={timeline} />
          <div className="flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-accent" /> WPM
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-faint" /> Raw
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-0.5 bg-error" /> Errors
            </span>
          </div>
        </motion.div>
      )}

      <motion.button
        variants={item}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={onRestart}
        className="rounded-md bg-accent px-8 py-2.5 font-semibold text-accent-contrast hover:bg-accent/90"
      >
        Try again
      </motion.button>

      <motion.div variants={item} className="flex w-full justify-center">
        <SaveProgressCta />
      </motion.div>
    </motion.div>
  )
}
