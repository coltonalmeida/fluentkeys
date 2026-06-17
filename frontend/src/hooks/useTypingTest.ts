import { useCallback, useEffect, useRef, useState } from 'react'
import { buildQuoteTarget } from '../lib/quotes'
import { applyNumbers, applyPunctuation, generateWords } from '../lib/selectWords'
import { computeStats, type TestStats, type WpmSample } from '../lib/stats'
import type { Difficulty, KeySetId } from '../lib/words'

export type CharState = 'pending' | 'correct' | 'incorrect'
export type TestStatus = 'idle' | 'running' | 'finished'
export type TestMode = 'words' | 'punctuation' | 'numbers' | 'quotes'

export interface TestSettings {
  keySet: KeySetId
  difficulty: Difficulty
  /** seconds */
  duration: number
  mode: TestMode
}

interface BuiltTarget {
  text: string
  /** Author attribution for quote mode (shown on the results screen). */
  attribution: string | null
}

// Enough words that fast typists never run out (≈300 WPM ceiling).
const wordCountFor = (duration: number) => Math.ceil((duration / 60) * 300)

function buildTarget(settings: TestSettings, weakKeys: Record<string, number>): BuiltTarget {
  const count = wordCountFor(settings.duration)

  if (settings.mode === 'quotes') {
    const { text, authors } = buildQuoteTarget(count)
    return { text, attribution: authors.join(', ') }
  }

  // Punctuation/numbers keep the weighted weak-key stream underneath.
  const words = generateWords(count, {
    keySet: settings.keySet,
    difficulty: settings.difficulty,
    weakKeys,
  })
  if (settings.mode === 'punctuation') return { text: applyPunctuation(words), attribution: null }
  if (settings.mode === 'numbers') return { text: applyNumbers(words), attribution: null }
  return { text: words.join(' '), attribution: null }
}

export function useTypingTest(
  settings: TestSettings,
  /** Persisted miss counts from past sessions (Phase 7) — merged in when they load. */
  seedWeakKeys?: Record<string, number>,
) {
  // Miss counts persist across restarts so selection biases toward weak keys.
  const weakKeysRef = useRef<Record<string, number>>({})
  const keystrokesRef = useRef(0)
  const seededRef = useRef(false)

  // Per-second WPM timeline, captured live as the test runs (feeds WpmChart).
  const timelineRef = useRef<WpmSample[]>([])
  const elapsedRef = useRef(0)
  const correctRef = useRef(0) // cumulative correct chars currently on screen
  const typedRef = useRef(0) // cumulative typed chars currently on screen (raw)
  const errorsThisSecondRef = useRef(0)

  // Live readout (rolling 5s WPM + running accuracy), refreshed on a 500ms tick —
  // same math the trainer uses. These counters only ever grow (backspace doesn't
  // un-press a key), so they're separate from the on-screen timeline counters.
  const correctTimestampsRef = useRef<number[]>([])
  const liveCorrectRef = useRef(0)

  const [target, setTarget] = useState(() => buildTarget(settings, {}).text)
  const [attribution, setAttribution] = useState<string | null>(null)
  const [charStates, setCharStates] = useState<CharState[]>([])
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<TestStatus>('idle')
  const [timeLeft, setTimeLeft] = useState(settings.duration)
  const [stats, setStats] = useState<TestStats | null>(null)
  const [timeline, setTimeline] = useState<WpmSample[]>([])
  const [liveWpm, setLiveWpm] = useState(0)
  const [liveAccuracy, setLiveAccuracy] = useState(100)

  const restart = useCallback(() => {
    keystrokesRef.current = 0
    timelineRef.current = []
    elapsedRef.current = 0
    correctRef.current = 0
    typedRef.current = 0
    errorsThisSecondRef.current = 0
    correctTimestampsRef.current = []
    liveCorrectRef.current = 0
    const built = buildTarget(settings, weakKeysRef.current)
    setTarget(built.text)
    setAttribution(built.attribution)
    setCharStates([])
    setIndex(0)
    setStatus('idle')
    setTimeLeft(settings.duration)
    setStats(null)
    setTimeline([])
    setLiveWpm(0)
    setLiveAccuracy(100)
  }, [settings])

  // New settings → new test
  useEffect(() => {
    restart()
  }, [restart])

  // Merge persisted weak keys once when they arrive; rebuild words if the
  // test hasn't started so the bias applies immediately.
  useEffect(() => {
    if (seededRef.current || !seedWeakKeys || Object.keys(seedWeakKeys).length === 0) return
    seededRef.current = true
    for (const [key, count] of Object.entries(seedWeakKeys)) {
      weakKeysRef.current[key] = (weakKeysRef.current[key] ?? 0) + count
    }
    setStatus((current) => {
      if (current === 'idle') {
        const built = buildTarget(settings, weakKeysRef.current)
        setTarget(built.text)
        setAttribution(built.attribution)
      }
      return current
    })
  }, [seedWeakKeys, settings])

  const finish = useCallback(
    (states: CharState[]) => {
      const correct = states.filter((s) => s === 'correct').length
      const incorrect = states.filter((s) => s === 'incorrect').length
      setStats(computeStats(correct, incorrect, keystrokesRef.current, settings.duration))
      setTimeline(timelineRef.current)
      setStatus('finished')
    },
    [settings.duration],
  )

  // Countdown + per-second timeline sampling
  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => {
      elapsedRef.current += 1
      const minutes = elapsedRef.current / 60
      timelineRef.current.push({
        t: elapsedRef.current,
        wpm: Math.round((correctRef.current / 5 / minutes) * 100) / 100,
        raw: Math.round((typedRef.current / 5 / minutes) * 100) / 100,
        errors: errorsThisSecondRef.current,
      })
      errorsThisSecondRef.current = 0
      setTimeLeft((t) => t - 1)
    }, 1000)
    return () => clearInterval(id)
  }, [status])

  useEffect(() => {
    if (status === 'running' && timeLeft <= 0) finish(charStates)
  }, [timeLeft, status, charStates, finish])

  // Live WPM (5-second rolling window) + running accuracy, every 500ms — mirrors
  // the trainer's readout so the timed test shows the same kind of feedback.
  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => {
      const now = performance.now()
      const recent = correctTimestampsRef.current.filter((t) => now - t <= 5000)
      correctTimestampsRef.current = recent
      setLiveWpm(Math.round((recent.length / 5) * 12))
      const presses = keystrokesRef.current
      setLiveAccuracy(presses === 0 ? 100 : Math.round((liveCorrectRef.current / presses) * 100))
    }, 500)
    return () => clearInterval(id)
  }, [status])

  const handleKey = useCallback(
    (key: string) => {
      if (status === 'finished') return

      if (key === 'Backspace') {
        if (index === 0) return
        // Keep the cumulative timeline counters in sync with what's on screen.
        if (charStates[index - 1] === 'correct') correctRef.current -= 1
        typedRef.current -= 1
        setIndex(index - 1)
        setCharStates((prev) => prev.slice(0, index - 1))
        return
      }

      // Only printable single characters count
      if (key.length !== 1) return
      if (status === 'idle') setStatus('running')

      keystrokesRef.current += 1
      typedRef.current += 1
      const expected = target[index]
      const correct = key === expected
      if (correct) {
        correctRef.current += 1
        liveCorrectRef.current += 1
        correctTimestampsRef.current.push(performance.now())
      } else {
        errorsThisSecondRef.current += 1
        if (expected !== undefined && expected !== ' ') {
          weakKeysRef.current[expected] = (weakKeysRef.current[expected] ?? 0) + 1
        }
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
    attribution,
    charStates,
    index,
    status,
    timeLeft,
    stats,
    timeline,
    liveWpm,
    liveAccuracy,
    handleKey,
    restart,
    /** Per-key miss counts for this session (feeds char_counts / Phase 7). */
    missCounts: weakKeysRef.current,
  }
}
