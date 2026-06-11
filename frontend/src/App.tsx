import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { apiRequest, postResult, type User } from './lib/api'
import { ResultsScreen } from './components/ResultsScreen'
import { StatsPanel } from './components/StatsPanel'
import { TypingArea } from './components/TypingArea'
import { useTypingTest, type TestSettings } from './hooks/useTypingTest'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from './lib/words'

const DURATIONS = [5, 15, 30, 60] as const

function App() {
  const [settings, setSettings] = useState<TestSettings>({
    keySet: 'all',
    difficulty: 'medium',
    duration: 30,
  })
  const { target, charStates, index, status, timeLeft, stats, handleKey, restart, missCounts } =
    useTypingTest(settings)
  const { isSignedIn, getToken } = useAuth()
  const [showStats, setShowStats] = useState(false)
  const [isPersonalBest, setIsPersonalBest] = useState(false)

  // Sync our users row on sign-in (backend upserts by clerk_id).
  useEffect(() => {
    if (!isSignedIn) return
    getToken()
      .then((token) => apiRequest<{ user: User }>('/auth/me', token))
      .catch((err) => console.error('user sync failed:', err))
  }, [isSignedIn, getToken])

  // Persist the result when a test finishes (signed-in users only).
  useEffect(() => {
    if (status !== 'finished' || !stats || !isSignedIn) return
    setIsPersonalBest(false)
    getToken()
      .then((token) =>
        postResult(token, {
          keySet: settings.keySet,
          difficulty: settings.difficulty,
          duration: settings.duration,
          wpm: stats.wpm,
          accuracy: stats.accuracy,
          rawWpm: stats.rawWpm,
          charCounts: {
            correct: stats.correctChars,
            incorrect: stats.incorrectChars,
            keystrokes: stats.totalKeystrokes,
            ...Object.fromEntries(
              Object.entries(missCounts).map(([k, v]) => [`miss_${k}`, v]),
            ),
          },
        }),
      )
      .then(({ isPersonalBest }) => setIsPersonalBest(isPersonalBest))
      .catch((err) => console.error('failed to save result:', err))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per finish
  }, [status])

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <header className="flex items-baseline justify-between">
          <h1 className="text-3xl font-bold text-emerald-400">FluentKeys</h1>
          <div className="flex items-baseline gap-6">
            <span className="font-mono text-2xl tabular-nums text-zinc-400">
              {status === 'running' ? `${timeLeft}s` : `${settings.duration}s`}
            </span>
            <SignedOut>
              <SignInButton mode="modal">
                <button type="button" className="text-sm text-zinc-400 underline hover:text-zinc-200">
                  Log in
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <button
                type="button"
                onClick={() => setShowStats((s) => !s)}
                className={`text-sm underline ${showStats ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                My stats
              </button>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        {/* Settings */}
        <div className="flex flex-wrap gap-4 text-sm">
          <Selector
            label="Keys"
            value={settings.keySet}
            options={Object.entries(KEY_SETS).map(([id, k]) => [id, k.label])}
            onChange={(v) => setSettings((s) => ({ ...s, keySet: v as KeySetId }))}
          />
          <Selector
            label="Difficulty"
            value={settings.difficulty}
            options={Object.entries(DIFFICULTIES).map(([id, d]) => [id, d.label])}
            onChange={(v) => setSettings((s) => ({ ...s, difficulty: v as Difficulty }))}
          />
          <Selector
            label="Time"
            value={String(settings.duration)}
            options={DURATIONS.map((d) => [String(d), `${d}s`])}
            onChange={(v) => setSettings((s) => ({ ...s, duration: Number(v) }))}
          />
        </div>

        <AnimatePresence mode="wait">
          {status === 'finished' && stats ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <ResultsScreen stats={stats} onRestart={restart} isPersonalBest={isPersonalBest} />
            </motion.div>
          ) : (
            <motion.div
              key="test"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
            >
              <TypingArea target={target} charStates={charStates} index={index} onKey={handleKey} />
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-sm text-zinc-600">
          {status === 'idle' ? 'Click the text and start typing to begin' : ' '}
        </p>

        {showStats && isSignedIn && <StatsPanel />}
      </div>
    </div>
  )
}

function Selector({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: [string, string][]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center gap-2 text-zinc-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100"
      >
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

export default App
