import { useAuth } from '@clerk/clerk-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getTrainingState, getWeakKeys, postTrainingImport, postTrainingSession } from '../lib/api'
import { clamp, strengthMapFrom } from '../lib/letterStrength'
import { loadLocalTraining, saveLocalTraining } from '../lib/trainingStore'
import { newestLetter, UNLOCK_THRESHOLD, unlockedLetters } from '../lib/unlocks'
import { useContentGenerator } from './useContentGenerator'
import { useLetterStrength } from './useLetterStrength'
import type { CharState } from './useTypingTest'

export type TrainerStatus = 'idle' | 'running' | 'finished'

export interface TrainerSummary {
  durationMs: number
  wordsTyped: number
  peakWpm: number
  avgAccuracy: number
  mostImproved: { letter: string; delta: number } | null
  weakest: { letter: string; strength: number } | null
  newUnlocks: string[]
}

/** How long to keep typing reaction times before they read as a stall. */
const MAX_REACTION_MS = 3000
/**
 * Recompute strengths / check unlocks every completed word so the strength panel
 * reflects a sloppy word right away (the user should *see* a letter drop). Cheap:
 * 26 letters × ≤20 scored samples.
 */
const RECOMPUTE_EVERY = 1

export function useTrainer() {
  const { isSignedIn, getToken } = useAuth()
  const initial = useMemo(() => loadLocalTraining(), [])
  const letter = useLetterStrength(initial)
  const { recordKeystroke, recompute, getSnapshot, hydrate, clearJustUnlocked } = letter
  const hydratedRemote = useRef(false)
  // Tracks sign-in for the persistence target without re-subscribing callbacks:
  // signed-in → localStorage (cloud-synced), anonymous → sessionStorage (per-session).
  const signedInRef = useRef(false)
  useEffect(() => {
    signedInRef.current = isSignedIn === true
  }, [isSignedIn])

  // Timed-test miss history feeds extra weak-key bias into generation (§25).
  const [missCounts, setMissCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!isSignedIn) return
    getToken()
      .then((token) => getWeakKeys(token))
      .then((r) => setMissCounts(r.weakKeys))
      .catch(() => {})
  }, [isSignedIn, getToken])

  const newest = newestLetter(letter.unlockedCount)
  const content = useContentGenerator({
    unlocked: letter.unlocked,
    strength: letter.strengthMap,
    newestLetter: newest,
    boostNewest: newest != null && (letter.strengthMap[newest] ?? 0) < UNLOCK_THRESHOLD,
    missCounts,
  })
  const { advanceLine, refreshNext } = content

  // Typing state. index drives the caret (state); a mirror ref keeps the stable
  // key handler in sync without re-subscribing on every keystroke.
  const [index, setIndex] = useState(0)
  const [charStates, setCharStates] = useState<CharState[]>([])
  const [status, setStatus] = useState<TrainerStatus>('idle')
  const [summary, setSummary] = useState<TrainerSummary | null>(null)

  // Live display values (refreshed on a 500ms tick).
  const [liveWpm, setLiveWpm] = useState(0)
  const [accuracy, setAccuracy] = useState(100)
  const [wordsTyped, setWordsTyped] = useState(0)
  const [newAchievements, setNewAchievements] = useState<string[]>([])

  const currentLineRef = useRef(content.currentLine)
  const indexRef = useRef(0)
  const statusRef = useRef<TrainerStatus>('idle')

  // Mirror the live line into a ref (in an effect, not during render) so the
  // stable key handler always reads the current line.
  useEffect(() => {
    currentLineRef.current = content.currentLine
  }, [content.currentLine])

  // Session accumulators (refs — they must not trigger renders per keystroke).
  // charShownAt is (re)set the moment a character becomes current, so its
  // initial value never feeds a real reaction time.
  const charShownAtRef = useRef(0)
  const sessionStartRef = useRef<number | null>(null)
  const sessionStartStrengthRef = useRef<Record<string, number>>({})
  const totalPressesRef = useRef(0)
  const correctPressesRef = useRef(0)
  const wordsCompletedRef = useRef(0)
  const peakWpmRef = useRef(0)
  const correctTimestampsRef = useRef<number[]>([])
  const sessionUnlocksRef = useRef<string[]>([])

  const setIndexBoth = useCallback((value: number) => {
    indexRef.current = value
    setIndex(value)
  }, [])

  // Arm the session: typing is ignored until the user presses Space / clicks
  // Start (gated in the UI behind the blurred keyboard), so a session begins on
  // purpose rather than on a stray keystroke.
  const begin = useCallback(() => {
    if (statusRef.current !== 'idle') return
    const now = Date.now()
    statusRef.current = 'running'
    setStatus('running')
    sessionStartRef.current = now
    sessionStartStrengthRef.current = strengthMapFrom(getSnapshot().windows)
    charShownAtRef.current = now
  }, [getSnapshot])

  const onKey = useCallback(
    (key: string) => {
      if (statusRef.current !== 'running') return // gated until begin() (§ start gate)
      if (key === 'Backspace') return // disabled by default — confront errors (§5.2)
      if (key.length !== 1) return

      const line = currentLineRef.current
      const i = indexRef.current
      const expected = line[i]
      if (expected === undefined) return

      const now = Date.now()
      const reactionMs = clamp(now - charShownAtRef.current, 0, MAX_REACTION_MS)
      const correct = key === expected

      totalPressesRef.current += 1
      if (correct) {
        correctPressesRef.current += 1
        correctTimestampsRef.current.push(now)
      }
      if (/^[a-z]$/i.test(expected)) {
        recordKeystroke(expected, correct, reactionMs)
      }

      if (!correct) {
        // Wrong key: mark red, do NOT advance — the user must correct it (§5.2).
        setCharStates((prev) => {
          const next = prev.slice()
          next[i] = 'incorrect'
          return next
        })
        return
      }

      setCharStates((prev) => {
        const next = prev.slice()
        next[i] = 'correct'
        return next
      })
      const nextIndex = i + 1
      charShownAtRef.current = now

      const finishedWord =
        expected !== ' ' && (line[nextIndex] === ' ' || nextIndex >= line.length)
      if (finishedWord) {
        wordsCompletedRef.current += 1
        setWordsTyped(wordsCompletedRef.current)
        if (wordsCompletedRef.current % RECOMPUTE_EVERY === 0) {
          const newly = recompute()
          if (newly) {
            sessionUnlocksRef.current.push(newly)
            refreshNext()
          }
          saveLocalTraining(getSnapshot(), signedInRef.current)
        }
      }

      if (nextIndex >= line.length) {
        advanceLine()
        setIndexBoth(0)
        setCharStates([])
        charShownAtRef.current = Date.now()
      } else {
        setIndexBoth(nextIndex)
      }
    },
    [recordKeystroke, recompute, refreshNext, advanceLine, getSnapshot, setIndexBoth],
  )

  // Live WPM (5-second rolling window) + session accuracy, every 500ms (§6.4).
  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => {
      const now = Date.now()
      const recent = correctTimestampsRef.current.filter((t) => now - t <= 5000)
      correctTimestampsRef.current = recent
      const wpm = Math.round((recent.length / 5) * 12)
      setLiveWpm(wpm)
      if (wpm > peakWpmRef.current) peakWpmRef.current = wpm
      const total = totalPressesRef.current
      setAccuracy(total === 0 ? 100 : Math.round((correctPressesRef.current / total) * 100))
    }, 500)
    return () => clearInterval(id)
  }, [status])

  const stop = useCallback(() => {
    if (statusRef.current !== 'running') return

    // A session with zero keystrokes counts for nothing — just disarm back to
    // idle (no save, no summary, no cloud post), as if it was never started.
    if (totalPressesRef.current === 0) {
      sessionStartRef.current = null
      statusRef.current = 'idle'
      setStatus('idle')
      return
    }

    statusRef.current = 'finished'
    setStatus('finished')

    const newly = recompute() // catch a final unlock between checkpoints
    if (newly) sessionUnlocksRef.current.push(newly)

    const snap = getSnapshot()
    saveLocalTraining(snap, signedInRef.current)

    const endStrength = strengthMapFrom(snap.windows)
    const unlocked = unlockedLetters(snap.unlockedCount)
    const startStrength = sessionStartStrengthRef.current

    let mostImproved: TrainerSummary['mostImproved'] = null
    let weakest: TrainerSummary['weakest'] = null
    for (const l of unlocked) {
      const end = endStrength[l] ?? 0
      const delta = end - (startStrength[l] ?? 0)
      if (delta > 0 && (!mostImproved || delta > mostImproved.delta)) {
        mostImproved = { letter: l, delta: Math.round(delta) }
      }
      if (!weakest || end < weakest.strength) {
        weakest = { letter: l, strength: Math.round(end) }
      }
    }

    const total = totalPressesRef.current
    setSummary({
      durationMs: Date.now() - (sessionStartRef.current ?? Date.now()),
      wordsTyped: wordsCompletedRef.current,
      peakWpm: peakWpmRef.current,
      avgAccuracy: total === 0 ? 100 : Math.round((correctPressesRef.current / total) * 100),
      mostImproved,
      weakest,
      newUnlocks: [...sessionUnlocksRef.current],
    })
  }, [recompute, getSnapshot])

  const practiceAgain = useCallback(() => {
    totalPressesRef.current = 0
    correctPressesRef.current = 0
    wordsCompletedRef.current = 0
    peakWpmRef.current = 0
    correctTimestampsRef.current = []
    sessionUnlocksRef.current = []
    sessionStartRef.current = null
    setWordsTyped(0)
    setLiveWpm(0)
    setAccuracy(100)
    setSummary(null)
    statusRef.current = 'idle'
    setStatus('idle')
    advanceLine()
    setIndexBoth(0)
    setCharStates([])
    charShownAtRef.current = Date.now()
  }, [advanceLine, setIndexBoth])

  // On sign-in, reconcile guest progress with the cloud profile (§19). If the
  // local (guest) state is further along than the account's — more letters
  // unlocked or more recorded samples — migrate it up and keep it, so signing up
  // never discards a guest's practice. Otherwise adopt the cloud profile
  // (cross-device continuity). Never clobber a session already in progress.
  useEffect(() => {
    if (!isSignedIn) {
      hydratedRemote.current = false
      return
    }
    if (hydratedRemote.current) return
    hydratedRemote.current = true
    const sampleCount = (w: Record<string, unknown[]>) =>
      Object.values(w).reduce((n, arr) => n + (arr?.length ?? 0), 0)
    getToken()
      .then(async (token) => {
        const state = await getTrainingState(token)
        if (statusRef.current !== 'idle') return
        const local = getSnapshot()
        const localAhead =
          local.unlockedCount > state.unlockedCount ||
          sampleCount(local.windows as Record<string, unknown[]>) >
            sampleCount(state.windows as Record<string, unknown[]>)
        if (localAhead) {
          const strength = strengthMapFrom(local.windows)
          const letters = Object.entries(local.windows).map(([l, samples]) => ({
            letter: l,
            strength: Math.round(strength[l] ?? 0),
            samples,
          }))
          await postTrainingImport(token, { unlockedCount: local.unlockedCount, letters })
          saveLocalTraining(local, true)
        } else {
          hydrate({ unlockedCount: state.unlockedCount, windows: state.windows })
          saveLocalTraining({ unlockedCount: state.unlockedCount, windows: state.windows }, true)
        }
      })
      .catch((err) => console.error('training state sync failed:', err))
  }, [isSignedIn, getToken, hydrate, getSnapshot])

  // Persist the finished session to the cloud (signed-in users).
  useEffect(() => {
    if (status !== 'finished' || !summary || !isSignedIn) return
    const snap = getSnapshot()
    const strength = strengthMapFrom(snap.windows)
    const letters = Object.entries(snap.windows).map(([l, samples]) => ({
      letter: l,
      strength: Math.round(strength[l] ?? 0),
      samples,
    }))
    getToken()
      .then((token) =>
        postTrainingSession(token, {
          unlockedCount: snap.unlockedCount,
          letters,
          session: {
            wordsTyped: summary.wordsTyped,
            peakWpm: summary.peakWpm,
            avgAccuracy: summary.avgAccuracy,
            newUnlocks: summary.newUnlocks,
            startedAt: Date.now() - summary.durationMs,
          },
        }),
      )
      .then((r) => r.newlyEarned.length > 0 && setNewAchievements(r.newlyEarned))
      .catch((err) => console.error('training session save failed:', err))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per finish
  }, [status])

  // Best-effort save if the tab is left mid-session.
  useEffect(() => () => saveLocalTraining(getSnapshot(), signedInRef.current), [getSnapshot])

  const nextChar = status === 'finished' ? null : (content.currentLine[index] ?? null)

  return {
    // text + typing
    line: content.currentLine,
    charStates,
    index,
    onKey,
    nextChar,
    // live stats
    liveWpm,
    accuracy,
    wordsTyped,
    // achievements earned when the finished session synced
    newAchievements,
    clearNewAchievements: () => setNewAchievements([]),
    // strength / keyboard
    strengthMap: letter.strengthMap,
    sampleCounts: letter.sampleCounts,
    unlocked: letter.unlocked,
    unlockedCount: letter.unlockedCount,
    justUnlocked: letter.justUnlocked,
    clearJustUnlocked,
    // session
    status,
    begin,
    stop,
    practiceAgain,
    summary,
    // persistence hook point (used by backend sync)
    hydrate,
  }
}
