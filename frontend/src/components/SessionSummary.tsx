import { motion } from 'framer-motion'
import type { TrainerSummary } from '../hooks/useTrainer'
import { SaveProgressCta } from './SaveProgressCta'

interface SessionSummaryProps {
  summary: TrainerSummary
  onPracticeAgain: () => void
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

/** Modal shown when the user ends a session (spec §6.6). */
export function SessionSummary({ summary, onPracticeAgain }: SessionSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-4 text-center text-xl font-bold text-fg">
          Session Complete
        </h2>

        <dl className="space-y-2 text-sm">
          <Row label="Duration" value={formatDuration(summary.durationMs)} />
          <Row label="Words typed" value={String(summary.wordsTyped)} />
          <Row label="Peak WPM" value={String(summary.peakWpm)} />
          <Row label="Avg accuracy" value={`${summary.avgAccuracy}%`} />
          <div className="my-2 border-t border-border" />
          <Row
            label="Most improved"
            value={
              summary.mostImproved
                ? `${summary.mostImproved.letter.toUpperCase()} +${summary.mostImproved.delta}`
                : '—'
            }
          />
          <Row
            label="Still weak"
            value={
              summary.weakest
                ? `${summary.weakest.letter.toUpperCase()} ${summary.weakest.strength}/100`
                : '—'
            }
          />
          <Row
            label="New unlocks"
            value={
              summary.newUnlocks.length > 0
                ? summary.newUnlocks.map((l) => l.toUpperCase()).join(' ')
                : '—'
            }
          />
        </dl>

        <button
          type="button"
          onClick={onPracticeAgain}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-contrast transition-colors hover:bg-accent/90"
        >
          Practice Again
        </button>

        <div className="mt-4">
          <SaveProgressCta />
        </div>
      </motion.div>
    </motion.div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono font-semibold tabular-nums text-fg">
        {value}
      </dd>
    </div>
  )
}
