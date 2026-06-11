import { useCallback, useEffect, useRef, useState } from 'react'
import { generateWords } from '../lib/selectWords'
import { computeStats, type TestStats } from '../lib/stats'
import type { Difficulty, KeySetId } from '../lib/words'

export type CharState = 'pending' | 'correct' | 'incorrect'
export type TestStatus = 'idle' | 'running' | 'finished'

export interface TestSettings {
  keySet: KeySetId
  difficulty: Difficulty
  /** seconds */
  duration: number
}

// Enough words that fast typists never run out (≈300 WPM ceiling).
const wordCountFor = (duration: number) => Math.ceil((duration / 60) * 300)

function buildTarget(settings: TestSettings, weakKeys: Record<string, number>): string {
  return generateWords(wordCountFor(settings.duration), {
    keySet: settings.keySet,
    difficulty: settings.difficulty,
    weakKeys,
  }).join(' ')
}

export function useTypingTest(settings: TestSettings) {
  // Miss counts persist across restarts so selection biases toward weak keys.
  const weakKeysRef = useRef<Record<string, number>>({})
  const keystrokesRef = useRef(0)

  const [target, setTarget] = useState(() => buildTarget(settings, {}))
  const [charStates, setCharStates] = useState<CharState[]>([])
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<TestStatus>('idle')
  const [timeLeft, setTimeLeft] = useState(settings.duration)
  const [stats, setStats] = useState<TestStats | null>(null)

  const restart = useCallback(() => {
    keystrokesRef.current = 0
    setTarget(buildTarget(settings, weakKeysRef.current))
    setCharStates([])
    setIndex(0)
    setStatus('idle')
    setTimeLeft(settings.duration)
    setStats(null)
  }, [settings])

  // New settings → new test
  useEffect(() => {
    restart()
  }, [restart])

  const finish = useCallback(
    (states: CharState[]) => {
      const correct = states.filter((s) => s === 'correct').length
      const incorrect = states.filter((s) => s === 'incorrect').length
      setStats(computeStats(correct, incorrect, keystrokesRef.current, settings.duration))
      setStatus('finished')
    },
    [settings.duration],
  )

  // Countdown
  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => {
      setTimeLeft((t) => t - 1)
    }, 1000)
    return () => clearInterval(id)
  }, [status])

  useEffect(() => {
    if (status === 'running' && timeLeft <= 0) finish(charStates)
  }, [timeLeft, status, charStates, finish])

  const handleKey = useCallback(
    (key: string) => {
      if (status === 'finished') return

      if (key === 'Backspace') {
        if (index === 0) return
        setIndex(index - 1)
        setCharStates((prev) => prev.slice(0, index - 1))
        return
      }

      // Only printable single characters count
      if (key.length !== 1) return
      if (status === 'idle') setStatus('running')

      keystrokesRef.current += 1
      const expected = target[index]
      const correct = key === expected
      if (!correct && expected !== undefined && expected !== ' ') {
        weakKeysRef.current[expected] = (weakKeysRef.current[expected] ?? 0) + 1
      }

      const next = [...charStates]
      next[index] = correct ? 'correct' : 'incorrect'
      setCharStates(next)
      setIndex(index + 1)

      if (index + 1 >= target.length) finish(next)
    },
    [status, index, target, charStates, finish],
  )

  return {
    target,
    charStates,
    index,
    status,
    timeLeft,
    stats,
    handleKey,
    restart,
    /** Per-key miss counts for this session (feeds char_counts / Phase 7). */
    missCounts: weakKeysRef.current,
  }
}
