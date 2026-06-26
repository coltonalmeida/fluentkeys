import { useAuth } from '@clerk/clerk-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResultsScreen } from '../components/ResultsScreen'
import { TypingArea } from '../components/TypingArea'
import { useHotkeys } from '../hooks/useHotkeys'
import { usePreferences } from '../hooks/usePreferences'
import { useTypingTest, type TestMode, type TestSettings } from '../hooks/useTypingTest'
import {
  ApiError,
  getDaily,
  getDailyLeaderboard,
  postDailyResult,
  type DailyConfig,
  type DailyLeaderboardEntry,
} from '../lib/api'
import type { CodeLanguage } from '../lib/preferences'
import type { Difficulty, KeySetId } from '../lib/words'

/** Daily challenge (§9): one shared, seeded test per day + its own leaderboard. */
export function DailyChallengePage() {
  const { isSignedIn, getToken } = useAuth()
  const { prefs } = usePreferences()
  const [cfg, setCfg] = useState<DailyConfig | null>(null)
  const [board, setBoard] = useState<DailyLeaderboardEntry[] | null>(null)
  const [copied, setCopied] = useState(false)
  // Once-per-day: set after this session's submit (or a 409 if already taken).
  const [justCompleted, setJustCompleted] = useState(false)

  useEffect(() => {
    let cancelled = false
    getToken()
      .then((token) => getDaily(token))
      .then((c) => !cancelled && setCfg(c))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [getToken])

  const loadBoard = useCallback(() => {
    getDailyLeaderboard()
      .then((r) => setBoard(r.entries))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  const settings = useMemo<TestSettings>(
    () => ({
      keySet: (cfg?.keySet ?? 'all') as KeySetId,
      difficulty: (cfg?.difficulty ?? 'medium') as Difficulty,
      duration: cfg?.duration ?? 30,
      mode: (cfg?.mode ?? 'words') as TestMode,
      codeLanguage: (cfg?.codeLanguage ?? prefs.codeLanguage) as CodeLanguage,
      seed: cfg?.seed ?? 0,
    }),
    [cfg, prefs.codeLanguage],
  )

  const test = useTypingTest(settings)
  useHotkeys({ restart: test.restart })

  // Submit the daily result once per finish (signed-in users), then refresh the board.
  useEffect(() => {
    if (test.status !== 'finished' || !test.stats || !isSignedIn || !cfg) return
    getToken()
      .then((token) =>
        postDailyResult(token, {
          wpm: test.stats!.wpm,
          accuracy: test.stats!.accuracy,
          rawWpm: test.stats!.rawWpm,
        }),
      )
      .then(() => {
        setJustCompleted(true)
        loadBoard()
      })
      .catch((err) => {
        // 409 = already taken today; still flip to the completed view.
        if (err instanceof ApiError && err.status === 409) setJustCompleted(true)
        else console.error('daily submit failed:', err)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per finish
  }, [test.status])

  const share = () => {
    const url = `${window.location.origin}/daily`
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  // Once-per-day: taken on a prior load (yourBest) or completed this session.
  const taken = cfg?.yourBest != null || justCompleted
  const myResult =
    justCompleted && test.stats
      ? { wpm: test.stats.wpm, accuracy: test.stats.accuracy }
      : (cfg?.yourBest ?? null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daily Challenge</h1>
          <p className="text-sm text-muted">
            {cfg ? `${cfg.date} · ${cfg.mode} · same words for everyone` : 'Loading today’s challenge…'}
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono tabular-nums text-muted">
          {test.status === 'running' && (
            <>
              <span>
                <span className="text-accent">{test.liveWpm}</span> wpm
              </span>
              <span>
                <span className="text-fg">{test.liveAccuracy}</span>% acc
              </span>
            </>
          )}
          <span className="text-2xl">
            {test.status === 'running' ? `${test.timeLeft}s` : `${settings.duration}s`}
          </span>
          <button
            type="button"
            onClick={share}
            className="rounded-md border border-border px-3 py-1 text-sm text-fg transition-colors hover:bg-surface"
          >
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>

      {!isSignedIn && (
        <p className="rounded-md bg-surface px-4 py-2 text-sm text-muted">
          Sign in to post your time to the daily leaderboard.
        </p>
      )}

      <section className="min-h-[10rem]">
        <AnimatePresence mode="wait">
          {test.status === 'finished' && test.stats ? (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -16 }}>
              <ResultsScreen
                stats={test.stats}
                timeline={test.timeline}
                missCounts={test.missCounts}
                onRestart={test.restart}
              />
            </motion.div>
          ) : taken ? (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 rounded-lg bg-surface p-10 text-center"
            >
              <div className="text-sm uppercase tracking-wider text-muted">
                Today’s challenge complete
              </div>
              {myResult && (
                <div className="flex flex-wrap justify-center gap-12">
                  <div>
                    <div className="text-5xl font-bold text-accent">{Math.round(myResult.wpm)}</div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-muted">WPM</div>
                  </div>
                  <div>
                    <div className="text-5xl font-bold text-fg">{myResult.accuracy.toFixed(1)}%</div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-muted">Accuracy</div>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted">Come back tomorrow for a new challenge.</p>
            </motion.div>
          ) : (
            <motion.div key="test" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.2 }}>
              {cfg ? (
                <TypingArea target={test.target} charStates={test.charStates} index={test.index} onKey={test.handleKey} codeMode={settings.mode === 'code'} />
              ) : (
                <p className="text-sm text-muted">Loading…</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Daily leaderboard */}
      <section className="flex flex-col gap-3 rounded-lg bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Today’s leaderboard
        </h2>
        {board === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : board.length === 0 ? (
          <p className="text-sm text-muted">No times yet today — set the pace!</p>
        ) : (
          <ol className="flex flex-col">
            {board.map((e, i) => (
              <li
                key={`${e.username}-${i}`}
                className="flex items-baseline gap-4 border-t border-border py-2 first:border-t-0"
              >
                <span className={`w-8 text-right font-mono ${i < 3 ? 'text-accent' : 'text-muted'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-fg">
                  {e.username ? (
                    <Link to={`/u/${encodeURIComponent(e.username)}`} className="hover:underline">
                      {e.username}
                    </Link>
                  ) : (
                    'anonymous'
                  )}
                </span>
                <span className="font-mono text-lg font-bold text-fg">
                  {Number(e.wpm).toFixed(0)}
                  <span className="ml-1 text-xs font-normal text-muted">wpm</span>
                </span>
                <span className="w-16 text-right text-sm text-muted">
                  {Number(e.accuracy).toFixed(1)}%
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
