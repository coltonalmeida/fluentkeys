import { useState } from 'react'
import { TypingArea } from './components/TypingArea'
import { useTypingTest, type TestSettings } from './hooks/useTypingTest'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from './lib/words'

const DURATIONS = [15, 30, 60] as const

function App() {
  const [settings, setSettings] = useState<TestSettings>({
    keySet: 'all',
    difficulty: 'medium',
    duration: 30,
  })
  const { target, charStates, index, status, timeLeft, stats, handleKey, restart } =
    useTypingTest(settings)

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <header className="flex items-baseline justify-between">
          <h1 className="text-3xl font-bold text-emerald-400">FluentKeys</h1>
          <span className="font-mono text-2xl tabular-nums text-zinc-400">
            {status === 'running' ? `${timeLeft}s` : `${settings.duration}s`}
          </span>
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

        {status === 'finished' && stats ? (
          <div className="flex flex-col items-center gap-6 rounded-lg bg-zinc-800/50 p-10">
            <div className="flex gap-12 text-center">
              <Stat label="WPM" value={stats.wpm.toFixed(0)} />
              <Stat label="Accuracy" value={`${stats.accuracy.toFixed(1)}%`} />
              <Stat label="Raw WPM" value={stats.rawWpm.toFixed(0)} />
            </div>
            <button
              type="button"
              onClick={restart}
              className="rounded-md bg-emerald-500 px-6 py-2 font-semibold text-zinc-900 hover:bg-emerald-400"
            >
              Try again
            </button>
          </div>
        ) : (
          <TypingArea target={target} charStates={charStates} index={index} onKey={handleKey} />
        )}

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-4xl font-bold text-emerald-400">{value}</div>
      <div className="text-sm uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  )
}

export default App
