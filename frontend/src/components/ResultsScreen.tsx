import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { TestStats } from '../lib/stats'

interface ResultsScreenProps {
  stats: TestStats
  onRestart: () => void
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

export function ResultsScreen({ stats, onRestart }: ResultsScreenProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center gap-8 rounded-lg bg-zinc-800/50 p-10"
    >
      <motion.h2 variants={item} className="text-xl font-semibold text-zinc-300">
        Test complete
      </motion.h2>

      <div className="flex flex-wrap justify-center gap-12 text-center">
        <motion.div variants={item}>
          <div className="text-6xl font-bold text-emerald-400">
            <AnimatedNumber value={stats.wpm} />
          </div>
          <div className="mt-1 text-sm uppercase tracking-wider text-zinc-500">WPM</div>
        </motion.div>
        <motion.div variants={item}>
          <div className="text-6xl font-bold text-zinc-100">
            <AnimatedNumber value={stats.accuracy} decimals={1} />%
          </div>
          <div className="mt-1 text-sm uppercase tracking-wider text-zinc-500">Accuracy</div>
        </motion.div>
        <motion.div variants={item}>
          <div className="text-6xl font-bold text-zinc-400">
            <AnimatedNumber value={stats.rawWpm} />
          </div>
          <div className="mt-1 text-sm uppercase tracking-wider text-zinc-500">Raw WPM</div>
        </motion.div>
      </div>

      <motion.div
        variants={item}
        className="flex gap-8 text-sm text-zinc-500"
      >
        <span>
          <span className="text-zinc-300">{stats.correctChars}</span> correct chars
        </span>
        <span>
          <span className="text-red-400">{stats.incorrectChars}</span> mistakes
        </span>
        <span>
          <span className="text-zinc-300">{stats.totalKeystrokes}</span> keystrokes
        </span>
      </motion.div>

      <motion.button
        variants={item}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={onRestart}
        className="rounded-md bg-emerald-500 px-8 py-2.5 font-semibold text-zinc-900 hover:bg-emerald-400"
      >
        Try again
      </motion.button>
    </motion.div>
  )
}
