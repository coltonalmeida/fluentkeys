import { useCallback, useRef, useState } from 'react'
import {
  pushSample,
  sampleCountsFrom,
  strengthMapFrom,
  type SampleWindows,
} from '../lib/letterStrength'
import { canUnlockNext, STARTER_COUNT, UNLOCK_ORDER, unlockedLetters } from '../lib/unlocks'
import type { TrainingState } from '../lib/trainingStore'

export interface UseLetterStrength {
  /** Strength 0–100 per letter (recomputed on `recompute`, e.g. every 10 words). */
  strengthMap: Record<string, number>
  /** Sample count per letter (gates unlocks). */
  sampleCounts: Record<string, number>
  /** How many letters are unlocked. */
  unlockedCount: number
  /** The unlocked letters, in unlock order. */
  unlocked: string[]
  /** Set momentarily when a new letter unlocks (drives toast + key pulse). */
  justUnlocked: string | null
  /** Record one keystroke into the expected letter's rolling window. */
  recordKeystroke: (expected: string, correct: boolean, reactionMs: number) => void
  /** Recompute strengths and check the unlock gate. Returns the newly unlocked letter, if any. */
  recompute: () => string | null
  /** Acknowledge a `justUnlocked` letter (hide the toast/pulse). */
  clearJustUnlocked: () => void
  /** Replace all state from a persisted snapshot (e.g. after a backend load). */
  hydrate: (state: TrainingState) => void
  /** Current persistable snapshot. */
  getSnapshot: () => TrainingState
}

/**
 * Owns the letter-strength state machine: rolling sample windows, derived
 * strength scores, and progressive unlocks. All the math lives in pure libs
 * (letterStrength.ts / unlocks.ts) — this hook is the React glue.
 */
export function useLetterStrength(initial: TrainingState): UseLetterStrength {
  const windowsRef = useRef<SampleWindows>(initial.windows)
  const unlockedCountRef = useRef(initial.unlockedCount)

  const [unlockedCount, setUnlockedCount] = useState(initial.unlockedCount)
  const [strengthMap, setStrengthMap] = useState<Record<string, number>>(() =>
    strengthMapFrom(initial.windows),
  )
  const [sampleCounts, setSampleCounts] = useState<Record<string, number>>(() =>
    sampleCountsFrom(initial.windows),
  )
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null)

  const recordKeystroke = useCallback(
    (expected: string, correct: boolean, reactionMs: number) => {
      const letter = expected.toLowerCase()
      if (!/^[a-z]$/.test(letter)) return // only real letters carry strength
      windowsRef.current[letter] = pushSample(windowsRef.current[letter], {
        key: letter,
        correct,
        reactionMs,
        timestamp: Date.now(),
      })
    },
    [],
  )

  const recompute = useCallback((): string | null => {
    const sm = strengthMapFrom(windowsRef.current)
    const sc = sampleCountsFrom(windowsRef.current)
    setStrengthMap(sm)
    setSampleCounts(sc)

    const prev = unlockedCountRef.current
    if (canUnlockNext(prev, sm, sc)) {
      const next = prev + 1
      const letter = UNLOCK_ORDER[next - 1] ?? null
      unlockedCountRef.current = next
      setUnlockedCount(next)
      if (letter) setJustUnlocked(letter)
      return letter
    }
    return null
  }, [])

  const clearJustUnlocked = useCallback(() => setJustUnlocked(null), [])

  const hydrate = useCallback((state: TrainingState) => {
    windowsRef.current = state.windows
    unlockedCountRef.current = state.unlockedCount
    setUnlockedCount(state.unlockedCount)
    setStrengthMap(strengthMapFrom(state.windows))
    setSampleCounts(sampleCountsFrom(state.windows))
  }, [])

  const getSnapshot = useCallback(
    (): TrainingState => ({
      unlockedCount: unlockedCountRef.current,
      windows: windowsRef.current,
    }),
    [],
  )

  return {
    strengthMap,
    sampleCounts,
    unlockedCount,
    unlocked: unlockedLetters(unlockedCount),
    justUnlocked,
    recordKeystroke,
    recompute,
    clearJustUnlocked,
    hydrate,
    getSnapshot,
  }
}

export { STARTER_COUNT }
