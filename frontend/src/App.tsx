import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { AuthPanel } from './components/AuthPanel'
import { ResultsScreen } from './components/ResultsScreen'
import { TypingArea } from './components/TypingArea'
import { useAuth } from './hooks/useAuth'
import { useTypingTest, type TestSettings } from './hooks/useTypingTest'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from './lib/words'

const DURATIONS = [5, 15, 30, 60] as const

function App() {
  const [settings, setSettings] = useState<TestSettings>({
    keySet: 'all',
    difficulty: 'medium',
    duration: 30,
  })
  const { target, charStates, index, status, timeLeft, stats, handleKey, restart } =
    useTypingTest(settings)
  const { user, logout } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <header className="flex items-baseline justify-between">
          <h1 className="text-3xl font-bold text-emerald-400">FluentKeys</h1>
          <div className="flex items-baseline gap-6">
            <span className="font-mono text-2xl tabular-nums text-zinc-400">
              {status === 'running' ? `${timeLeft}s` : `${settings.duration}s`}
            </span>
            {user ? (
              <span className="text-sm text-zinc-400">
                <span className="text-emerald-400">{user.username}</span>{' '}
                <button type="button" onClick={logout} className="text-zinc-500 underline hover:text-zinc-300">
                  log out
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="text-sm text-zinc-400 underline hover:text-zinc-200"
              >
                Log in
              </button>
            )}
          </div>
        </header>

        {showAuth && !user && <AuthPanel onClose={() => setShowAuth(false)} />}

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
              <ResultsScreen stats={stats} onRestart={restart} />
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
