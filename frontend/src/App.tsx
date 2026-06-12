import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { apiRequest, getWeakKeys, postResult, type User } from './lib/api'
import { Cursor } from './components/Cursor'
import { KeyboardVisual } from './components/KeyboardVisual'
import { Leaderboard } from './components/Leaderboard'
import { ResultsScreen } from './components/ResultsScreen'
import { StatsPanel } from './components/StatsPanel'
import { ThemeToggle } from './components/ThemeToggle'
import { TypingArea } from './components/TypingArea'
import { BoxLid } from './components/Unboxing'
import { useTheme } from './hooks/useTheme'
import { useTypingTest, type TestSettings } from './hooks/useTypingTest'
import { CHAR_TO_KEY } from './lib/keyboard'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from './lib/words'

const DURATIONS = [5, 15, 30, 60] as const

const NAV_BUTTON = (active: boolean) =>
  `text-sm underline ${
    active
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
  }`

function App() {
  const [settings, setSettings] = useState<TestSettings>({
    keySet: 'all',
    difficulty: 'medium',
    duration: 30,
  })
  const { isSignedIn, getToken } = useAuth()
  const [persistedWeakKeys, setPersistedWeakKeys] = useState<Record<string, number> | undefined>()
  const { target, charStates, index, status, timeLeft, stats, handleKey, restart, missCounts } =
    useTypingTest(settings, persistedWeakKeys)
  const [showStats, setShowStats] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  // The unboxing reveals the practice keyboard, so practice starts open.
  const [showPractice, setShowPractice] = useState(true)
  const [introDone, setIntroDone] = useState(false)
  const { theme, toggle: toggleTheme } = useTheme()
  const [flashKeyId, setFlashKeyId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Wrong keypresses flash the offending key on the visual keyboard.
  const handleTestKey = (key: string) => {
    if (!introDone) return // no typing while the box is still on
    if (showPractice && key.length === 1 && key !== target[index]) {
      const pressed = CHAR_TO_KEY[key]
      if (pressed) {
        setFlashKeyId(pressed.keyId)
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlashKeyId(null), 200)
      }
    }
    handleKey(key)
  }
  const [isPersonalBest, setIsPersonalBest] = useState(false)

  // Sync our users row on sign-in (backend upserts by clerk_id).
  useEffect(() => {
    if (!isSignedIn) return
    getToken()
      .then(async (token) => {
        await apiRequest<{ user: User }>('/auth/me', token)
        // Phase 7: bias word selection toward this user's historical weak keys.
        const { weakKeys } = await getWeakKeys(token)
        setPersistedWeakKeys(weakKeys)
      })
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

  // While the lid is on, the rest of the UI is laid out but invisible; it
  // bleeds in around the keyboard, which never unmounts.
  const bleedIn = {
    initial: { opacity: 0, y: 8 },
    animate: introDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
    transition: { duration: 0.6 },
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      <Cursor />
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <motion.header {...bleedIn} className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">FluentKeys</h1>
          <div className="flex items-center gap-6">
            <span className="font-mono text-2xl tabular-nums text-zinc-500 dark:text-zinc-400">
              {status === 'running' ? `${timeLeft}s` : `${settings.duration}s`}
            </span>
            <button type="button" onClick={() => setShowPractice((s) => !s)} className={NAV_BUTTON(showPractice)}>
              Practice
            </button>
            <button type="button" onClick={() => setShowLeaderboard((s) => !s)} className={NAV_BUTTON(showLeaderboard)}>
              Leaderboard
            </button>
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Log in
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <button type="button" onClick={() => setShowStats((s) => !s)} className={NAV_BUTTON(showStats)}>
                My stats
              </button>
              <UserButton />
            </SignedIn>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </motion.header>

        {/* Settings */}
        <motion.div {...bleedIn} className="flex flex-wrap gap-4 text-sm">
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
        </motion.div>

        <motion.div {...bleedIn}>
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
              <TypingArea target={target} charStates={charStates} index={index} onKey={handleTestKey} />
            </motion.div>
          )}
        </AnimatePresence>
        </motion.div>

        {/* Practice: the visual keyboard guides the main test. The unboxing
            lid sits on top of it and lifts away without remounting it. */}
        {showPractice && status !== 'finished' && (
          <div className="relative self-center">
            <KeyboardVisual
              nextChar={introDone ? (target[index] ?? null) : null}
              flashKeyId={flashKeyId}
              showInfo={introDone}
            />
            {!introDone && <BoxLid onDone={() => setIntroDone(true)} />}
          </div>
        )}

        <motion.p {...bleedIn} className="text-center text-sm text-zinc-500 dark:text-zinc-600">
          {status === 'idle'
            ? showPractice
              ? 'Click the text and start typing — the lit key shows the next character'
              : 'Click the text and start typing to begin'
            : ' '}
        </motion.p>

        {showLeaderboard && <Leaderboard />}
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
    <label className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
