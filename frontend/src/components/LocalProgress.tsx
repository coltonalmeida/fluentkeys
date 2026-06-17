import { useMemo, useState } from 'react'
import { displayStrengthMap, sampleCountsFrom } from '../lib/letterStrength'
import { loadLocalTraining } from '../lib/trainingStore'
import { TOTAL_LETTERS, unlockedLetters } from '../lib/unlocks'
import { LetterStrengthPanel } from './LetterStrengthPanel'

/**
 * Anonymous Profile view: this browser session's local trainer progress, read
 * from the same store the trainer writes to. It is intentionally session-only
 * (cleared on browser close) — signing in is what persists it. Reuses the trainer's
 * LetterStrengthPanel so the cards look identical to the home page.
 */
export function LocalProgress() {
  // Snapshot "now" once at mount so decay is computed against a stable clock.
  const [now] = useState(() => Date.now())
  const { strength, sampleCounts, unlocked, unlockedCount } = useMemo(() => {
    const state = loadLocalTraining()
    return {
      strength: displayStrengthMap(state.windows, now),
      sampleCounts: sampleCountsFrom(state.windows),
      unlocked: unlockedLetters(state.unlockedCount),
      unlockedCount: state.unlockedCount,
    }
  }, [now])

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          This session
        </h2>
        <span className="text-xs text-muted">
          {unlockedCount}/{TOTAL_LETTERS} letters unlocked
        </span>
      </div>
      <p className="text-sm text-muted">
        You're browsing without an account, so this progress is only saved for this
        session. Create an account to keep it, track personal bests, and join the
        leaderboard.
      </p>
      <LetterStrengthPanel
        strength={strength}
        sampleCounts={sampleCounts}
        unlocked={unlocked}
        unlockedCount={unlockedCount}
      />
    </div>
  )
}
