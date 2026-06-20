import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ResultsScreen } from '../components/ResultsScreen'
import { TypingArea } from '../components/TypingArea'
import { useHotkeys } from '../hooks/useHotkeys'
import { usePreferences } from '../hooks/usePreferences'
import { useTypingTest, type TestSettings } from '../hooks/useTypingTest'
import { getDuel, type DuelData } from '../lib/api'

// Race ends on completion; this only caps a stalled challenger so they eventually
// time out (and lose for not finishing).
const DUEL_TIME_CAP = 120

/** Async ghost duel (§3): type the creator's exact words and race their replay. */
export function DuelPage() {
  const { code = '' } = useParams()
  const { prefs } = usePreferences()
  const [duel, setDuel] = useState<DuelData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading')

  useEffect(() => {
    let cancelled = false
    getDuel(code)
      .then((d) => {
        if (cancelled) return
        setDuel(d)
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('notfound'))
    return () => {
      cancelled = true
    }
  }, [code])

  const settings = useMemo<TestSettings>(
    () => ({
      keySet: 'all',
      difficulty: 'medium',
      // Generous cap so completion — not the clock — ends the race; a far-too-slow
      // challenger eventually times out (and loses for not finishing).
      duration: DUEL_TIME_CAP,
      mode: 'words',
      codeLanguage: prefs.codeLanguage,
      fixedTarget: duel?.target ?? '',
    }),
    [duel, prefs.codeLanguage],
  )

  const test = useTypingTest(settings)
  useHotkeys({ restart: test.restart })

  // Ghost progress (0–1): replay the creator's events on the player's clock,
  // starting the moment the player begins typing.
  const [ghostProgress, setGhostProgress] = useState(0)
  const ghostStartRef = useRef<number | null>(null)

  useEffect(() => {
    if (test.status === 'idle') {
      ghostStartRef.current = null
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the ghost when the race restarts
      setGhostProgress(0)
    }
  }, [test.status])

  useEffect(() => {
    if (!duel || test.status !== 'running') return
    if (ghostStartRef.current == null) ghostStartRef.current = performance.now()
    const targetLen = Math.max(1, duel.target.length)
    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - (ghostStartRef.current ?? now)
      let idx = 0
      for (const e of duel.events) {
        if (e.t > elapsed) break
        if (e.ch === '\b') {
          if (idx > 0) idx -= 1
        } else {
          idx += 1
        }
      }
      setGhostProgress(Math.min(1, idx / targetLen))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [duel, test.status])

  if (status === 'loading') return <p className="text-sm text-muted">Loading duel…</p>
  if (status === 'notfound' || !duel) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">This duel link is invalid or expired.</p>
        <Link to="/test" className="text-sm text-accent underline">
          Take a regular test
        </Link>
      </div>
    )
  }

  const playerProgress = Math.min(1, test.index / Math.max(1, duel.target.length))
  const finished = test.status === 'finished' && test.stats
  // Win only by finishing the whole passage AND beating the creator's WPM.
  const completed = finished && test.index >= duel.target.length
  const won = completed && test.stats!.wpm > duel.creatorWpm
  const myWpm = finished ? Math.round(test.stats!.wpm) : 0
  const theirWpm = Math.round(duel.creatorWpm)
  const rival = duel.creatorUsername ?? 'Your rival'
  const resultText = !finished
    ? ''
    : !completed
      ? `You didn't finish — ${rival} wins. Try again!`
      : won
        ? `🏆 You win! ${myWpm} vs ${theirWpm} wpm`
        : `So close — ${myWpm} vs ${theirWpm} wpm. ${rival} holds the lead.`

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Duel</h1>
        <p className="text-sm text-muted">
          Racing <span className="text-fg">{duel.creatorUsername ?? 'a rival'}</span> ·{' '}
          {Math.round(duel.creatorWpm)} wpm to beat
        </p>
      </div>

      {/* Race bars */}
      <div className="flex flex-col gap-3 rounded-lg bg-surface p-4">
        <RaceBar label="You" progress={playerProgress} wpm={test.liveWpm} accent />
        <RaceBar label={duel.creatorUsername ?? 'Rival'} progress={ghostProgress} wpm={duel.creatorWpm} />
      </div>

      <section className="min-h-[10rem]">
        <AnimatePresence mode="wait">
          {finished ? (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div
                className={`mb-4 rounded-lg px-4 py-3 text-center font-semibold ${
                  won ? 'bg-accent/15 text-accent' : 'bg-surface text-muted'
                }`}
              >
                {resultText}
              </div>
              <ResultsScreen
                stats={test.stats!}
                timeline={test.timeline}
                missCounts={test.missCounts}
                onRestart={test.restart}
              />
            </motion.div>
          ) : (
            <motion.div key="test" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <TypingArea target={test.target} charStates={test.charStates} index={test.index} onKey={test.handleKey} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}

function RaceBar({
  label,
  progress,
  wpm,
  accent,
}: {
  label: string
  progress: number
  wpm: number
  accent?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 truncate text-sm text-muted">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${accent ? 'bg-accent' : 'bg-faint'}`}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-sm text-fg">{Math.round(wpm)} wpm</span>
    </div>
  )
}
