import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Trace, TraceEvent } from '../lib/api'
import { buildCodeTarget } from '../lib/codeSnippets'
import type { CodeLanguage } from '../lib/preferences'
import { buildQuoteTarget } from '../lib/quotes'
import { mulberry32 } from '../lib/rng'
import { applyNumbers, applyPunctuation, generateWords } from '../lib/selectWords'
import { computeStats, type TestStats, type WpmSample } from '../lib/stats'
import type { Difficulty, KeySetId } from '../lib/words'

/** Cap on recorded keystroke events (matches the backend bound). */
const MAX_TRACE_EVENTS = 6000

export type CharState = 'pending' | 'correct' | 'incorrect'
export type TestStatus = 'idle' | 'running' | 'finished'
export type TestMode = 'words' | 'punctuation' | 'numbers' | 'quotes' | 'code'

export interface TestSettings {
  keySet: KeySetId
  difficulty: Difficulty
  /** seconds */
  duration: number
  mode: TestMode
  /** Language for code mode (sourced from user preferences). */
  codeLanguage: CodeLanguage
  /** When set, words are generated deterministically from this seed and weak-key
   *  bias is skipped, so every client gets identical text (daily challenge §9). */
  seed?: number
  /** When set, this exact text is used verbatim (duel challenger §3). */
  fixedTarget?: string
}

interface BuiltTarget {
  text: string
  /** Author attribution for quote mode (shown on the results screen). */
  attribution: string | null
}

// Enough words that fast typists never run out (≈300 WPM ceiling).
const wordCountFor = (duration: number) => Math.ceil((duration / 60) * 300)

function buildTarget(settings: TestSettings, weakKeys: Record<string, number>): BuiltTarget {
  // Duels supply the exact text to type, verbatim.
  if (settings.fixedTarget != null) return { text: settings.fixedTarget, attribution: null }

  const count = wordCountFor(settings.duration)
  // Seeded → deterministic content, identical for everyone (daily challenge). One
  // rng instance feeds every generator so all modes are reproducible from the
  // seed; we also drop the per-user weak-key bias so the stream is shared.
  const rng = settings.seed != null ? mulberry32(settings.seed) : undefined

  if (settings.mode === 'quotes') {
    const { text, authors } = buildQuoteTarget(count, rng)
    return { text, attribution: authors.join(', ') }
  }

  if (settings.mode === 'code') {
    return { text: buildCodeTarget(count, settings.codeLanguage, rng).text, attribution: null }
  }

  // Punctuation/numbers keep the weighted weak-key stream underneath.
  const words = generateWords(count, {
    keySet: settings.keySet,
    difficulty: settings.difficulty,
    weakKeys: rng ? undefined : weakKeys,
    rng,
  })
  if (settings.mode === 'punctuation') return { text: applyPunctuation(words, rng), attribution: null }
  if (settings.mode === 'numbers') return { text: applyNumbers(words, rng), attribution: null }
  return { text: words.join(' '), attribution: null }
}

/**
 * Indices that should NOT count toward speed/keystroke stats: the 2nd-and-later
 * spaces of each line's *leading* indentation. The first space of an indent run
 * carries the whole block as one unit, so a 4-space indent scores like a single
 * keystroke — and identically whether typed manually or filled by Tab. Mid-line
 * spaces and non-code targets (no leading runs) yield an empty set, so every other
 * mode is unaffected.
 */
function indentSkipIndices(target: string): Set<number> {
  const skip = new Set<number>()
  let atLineStart = true
  let sawFirstIndentSpace = false
  for (let i = 0; i < target.length; i++) {
    const c = target[i]
    if (c === '\n') {
      atLineStart = true
      sawFirstIndentSpace = false
      continue
    }
    if (atLineStart && c === ' ') {
      if (sawFirstIndentSpace) skip.add(i) // 2nd+ space of the indent — weightless
      else sawFirstIndentSpace = true // first space carries the unit
      continue
    }
    atLineStart = false // any non-space (or space past line start) ends the indent
  }
  return skip
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

  // Per-keystroke trace for replay / heatmap / duel ghost (§3/§27). Timestamps are
  // ms from the first keystroke; '\b' marks a backspace.
  const traceRef = useRef<TraceEvent[]>([])
  const traceStartRef = useRef(0)

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

  // Indent spaces that don't count toward stats (see indentSkipIndices). Each
  // line's leading-indent block collapses to one unit for WPM and keystrokes.
  const indentSkip = useMemo(() => indentSkipIndices(target), [target])

  const restart = useCallback(() => {
    keystrokesRef.current = 0
    traceRef.current = []
    traceStartRef.current = 0
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
  // test hasn't started so the bias applies immediately. Skipped for seeded
  // (daily) tests, which must stay identical for every user.
  useEffect(() => {
    if (settings.seed != null) return
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
    (states: CharState[], completed = false) => {
      // Skip weightless indent spaces so the final WPM matches the live readout
      // (keystrokesRef is already collapsed in handleKey, keeping accuracy consistent).
      let correct = 0
      let incorrect = 0
      for (let i = 0; i < states.length; i++) {
        if (indentSkip.has(i)) continue
        if (states[i] === 'correct') correct += 1
        else if (states[i] === 'incorrect') incorrect += 1
      }
      // A completed run (typed the whole target — e.g. a duel passage) is measured
      // over the real elapsed time; a timed run uses its fixed duration.
      const elapsed =
        completed && traceStartRef.current
          ? Math.max(0.5, (performance.now() - traceStartRef.current) / 1000)
          : settings.duration
      setStats(computeStats(correct, incorrect, keystrokesRef.current, elapsed))
      setTimeline(timelineRef.current)
      setStatus('finished')
    },
    [settings.duration, indentSkip],
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
        // Weightless indent spaces never bumped these, so don't un-bump them.
        if (!indentSkip.has(index - 1)) {
          if (charStates[index - 1] === 'correct') correctRef.current -= 1
          typedRef.current -= 1
        }
        if (traceStartRef.current && traceRef.current.length < MAX_TRACE_EVENTS) {
          traceRef.current.push({ t: Math.round(performance.now() - traceStartRef.current), ch: '\b', ok: true })
        }
        setIndex(index - 1)
        setCharStates((prev) => prev.slice(0, index - 1))
        return
      }

      // Tab (code mode only): auto-type the line's leading indentation — the run
      // of spaces from the caret up to the next non-space char. Matches the
      // snippet's exact indent depth; a no-op anywhere the next char isn't a space.
      if (key === 'Tab') {
        if (settings.mode !== 'code') return
        let run = 0
        while (target[index + run] === ' ') run += 1
        if (run === 0) return
        if (status === 'idle') {
          setStatus('running')
          traceStartRef.current = performance.now()
        }
        // The whole indent block counts as one unit (one keystroke / one correct
        // char), matching a manually-typed indent where only the first space
        // counts. Trace still records every space so replay reproduces the indent.
        keystrokesRef.current += 1
        typedRef.current += 1
        correctRef.current += 1
        liveCorrectRef.current += 1
        correctTimestampsRef.current.push(performance.now())
        const next = [...charStates]
        for (let k = 0; k < run; k++) {
          if (traceRef.current.length < MAX_TRACE_EVENTS) {
            traceRef.current.push({
              t: Math.round(performance.now() - traceStartRef.current),
              ch: ' ',
              ok: true,
            })
          }
          next[index + k] = 'correct'
        }
        setCharStates(next)
        setIndex(index + run)
        if (index + run >= target.length) finish(next, true)
        return
      }

      // Enter types a newline (code mode); otherwise only printable single chars.
      const ch = key === 'Enter' ? '\n' : key
      if (ch.length !== 1) return
      if (status === 'idle') {
        setStatus('running')
        traceStartRef.current = performance.now()
      }

      // Weightless = a 2nd+ space of leading indentation: it still renders and
      // advances, but doesn't bump any stat counter, so the indent block scores as
      // a single unit (identically to filling it with Tab).
      const weightless = indentSkip.has(index)
      if (!weightless) {
        keystrokesRef.current += 1
        typedRef.current += 1
      }
      const expected = target[index]
      const correct = ch === expected
      if (traceRef.current.length < MAX_TRACE_EVENTS) {
        traceRef.current.push({ t: Math.round(performance.now() - traceStartRef.current), ch, ok: correct })
      }
      if (correct) {
        if (!weightless) {
          correctRef.current += 1
          liveCorrectRef.current += 1
          correctTimestampsRef.current.push(performance.now())
        }
      } else {
        if (!weightless) errorsThisSecondRef.current += 1
        if (expected !== undefined && expected !== ' ' && expected !== '\n') {
          weakKeysRef.current[expected] = (weakKeysRef.current[expected] ?? 0) + 1
        }
      }

      const next = [...charStates]
      next[index] = correct ? 'correct' : 'incorrect'
      setCharStates(next)
      setIndex(index + 1)

      if (index + 1 >= target.length) finish(next, true)
    },
    [status, index, target, charStates, finish, settings.mode, indentSkip],
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
    /** Captured keystroke trace for replay / duels (read after finish). */
    getTrace: (): Trace => ({
      target,
      durationSeconds: settings.duration,
      events: traceRef.current,
    }),
  }
}
