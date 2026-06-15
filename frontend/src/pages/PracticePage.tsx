import { useAuth } from '@clerk/clerk-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyboardVisual } from '../components/KeyboardVisual'
import { ResultsScreen } from '../components/ResultsScreen'
import { TypingArea } from '../components/TypingArea'
import { usePreferences } from '../hooks/usePreferences'
import { useTypingTest, type TestSettings } from '../hooks/useTypingTest'
import { apiRequest, getWeakKeys, postResult, type User } from '../lib/api'
import { getLayout } from '../lib/keyboard'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from '../lib/words'

const DURATIONS = [5, 15, 30, 60] as const

// The timed test (/test). The unboxing animation belongs to the home page only,
// so this page shows its keyboard immediately.
export function PracticePage() {
  const { t } = useTranslation()
  const { prefs } = usePreferences()
  const layout = useMemo(() => getLayout(prefs.keyboardLayout), [prefs.keyboardLayout])

  const [settings, setSettings] = useState<TestSettings>({
    keySet: 'all',
    difficulty: 'medium',
    duration: 30,
  })
  const { isSignedIn, getToken } = useAuth()
  const [persistedWeakKeys, setPersistedWeakKeys] = useState<Record<string, number> | undefined>()
  const { target, charStates, index, status, timeLeft, stats, handleKey, restart, missCounts } =
    useTypingTest(settings, persistedWeakKeys)

  const [flashKeyId, setFlashKeyId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPersonalBest, setIsPersonalBest] = useState(false)

  // Wrong keypresses flash the offending key on the visual keyboard.
  const handleTestKey = (key: string) => {
    if (key.length === 1 && key !== target[index]) {
      const pressed = layout.charToKey[key]
      if (pressed) {
        setFlashKeyId(pressed.keyId)
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlashKeyId(null), 200)
      }
    }
    handleKey(key)
  }

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the prior result's PB flag before the new one resolves
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

  const showKeyboard = status !== 'finished'

  return (
    <div className="flex flex-col gap-6">
      {/* Controls + timer */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex flex-wrap gap-4">
          <Selector
            label={t('practice.keys')}
            value={settings.keySet}
            options={Object.entries(KEY_SETS).map(([id, k]) => [id, k.label])}
            onChange={(v) => setSettings((s) => ({ ...s, keySet: v as KeySetId }))}
          />
          <Selector
            label={t('practice.difficulty')}
            value={settings.difficulty}
            options={Object.entries(DIFFICULTIES).map(([id, d]) => [id, d.label])}
            onChange={(v) => setSettings((s) => ({ ...s, difficulty: v as Difficulty }))}
          />
          <Selector
            label={t('practice.time')}
            value={String(settings.duration)}
            options={DURATIONS.map((d) => [String(d), `${d}s`])}
            onChange={(v) => setSettings((s) => ({ ...s, duration: Number(v) }))}
          />
        </div>
        <span className="font-mono text-2xl tabular-nums text-zinc-500 dark:text-zinc-400">
          {status === 'running' ? `${timeLeft}s` : `${settings.duration}s`}
        </span>
      </div>

      {/* Test box — bounded so it never shares space with the keyboard. */}
      <section className="min-h-[10rem]">
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
      </section>

      {/* Explicit divider: keeps clear vertical rhythm between the two blocks. */}
      {showKeyboard && <hr className="border-zinc-200 dark:border-zinc-800" />}

      {/* Keyboard block — bounded min-height, centered. */}
      {showKeyboard && (
        <section className="flex min-h-[18rem] items-start justify-center overflow-visible">
          <KeyboardVisual nextChar={target[index] ?? null} flashKeyId={flashKeyId} layout={layout} />
        </section>
      )}

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-600">
        {status === 'idle' ? t('practice.hintPractice') : ' '}
      </p>
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
