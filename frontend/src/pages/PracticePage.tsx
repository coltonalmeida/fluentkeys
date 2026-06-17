import { useAuth } from '@clerk/clerk-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AchievementToast } from '../components/AchievementToast'
import { KeyboardVisual } from '../components/KeyboardVisual'
import { ResultsScreen } from '../components/ResultsScreen'
import { TypingArea } from '../components/TypingArea'
import { useHotkeys } from '../hooks/useHotkeys'
import { usePreferences } from '../hooks/usePreferences'
import { useTypingTest, type TestMode, type TestSettings } from '../hooks/useTypingTest'
import { apiRequest, getWeakKeys, postResult, type User } from '../lib/api'
import { formatCombo } from '../lib/hotkeys'
import { getLayout } from '../lib/keyboard'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from '../lib/words'

const DURATIONS = [5, 15, 30, 60] as const
const MODES: [TestMode, string][] = [
  ['words', 'Words'],
  ['punctuation', 'Punctuation'],
  ['numbers', 'Numbers'],
  ['quotes', 'Quotes'],
]

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
    mode: 'words',
  })
  const { isSignedIn, getToken } = useAuth()
  const [persistedWeakKeys, setPersistedWeakKeys] = useState<Record<string, number> | undefined>()
  const {
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
    missCounts,
  } = useTypingTest(settings, persistedWeakKeys)

  const [flashKeyId, setFlashKeyId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPersonalBest, setIsPersonalBest] = useState(false)
  const [newAchievements, setNewAchievements] = useState<string[]>([])

  // Restart hotkey (default Tab) — works mid-test and on the results screen.
  useHotkeys({ restart })

  // Auto-dismiss the achievement toast.
  useEffect(() => {
    if (newAchievements.length === 0) return
    const id = setTimeout(() => setNewAchievements([]), 3500)
    return () => clearTimeout(id)
  }, [newAchievements])

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
      .then(({ isPersonalBest, newlyEarned }) => {
        setIsPersonalBest(isPersonalBest)
        if (newlyEarned.length > 0) setNewAchievements(newlyEarned)
      })
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
            label="mode"
            value={settings.mode}
            options={MODES}
            onChange={(v) => setSettings((s) => ({ ...s, mode: v as TestMode }))}
          />
          <Selector
            label={t('practice.time')}
            value={String(settings.duration)}
            options={DURATIONS.map((d) => [String(d), `${d}s`])}
            onChange={(v) => setSettings((s) => ({ ...s, duration: Number(v) }))}
          />
        </div>
        <div className="flex items-center gap-4 font-mono tabular-nums text-muted">
          {status === 'running' && (
            <>
              <span>
                <span className="text-accent">{liveWpm}</span> wpm
              </span>
              <span>
                <span className="text-fg">{liveAccuracy}</span>% acc
              </span>
            </>
          )}
          <span className="text-2xl">
            {status === 'running' ? `${timeLeft}s` : `${settings.duration}s`}
          </span>
        </div>
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
              <ResultsScreen
                stats={stats}
                timeline={timeline}
                missCounts={missCounts}
                attribution={attribution}
                onRestart={restart}
                isPersonalBest={isPersonalBest}
              />
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
      {showKeyboard && <hr className="border-border" />}

      {/* Keyboard block — bounded min-height, centered. */}
      {showKeyboard && (
        <section className="flex min-h-[18rem] items-start justify-center overflow-visible">
          <KeyboardVisual nextChar={target[index] ?? null} flashKeyId={flashKeyId} layout={layout} />
        </section>
      )}

      <p className="text-center text-sm text-muted">
        {status === 'idle'
          ? t('practice.hintPractice')
          : `Press ${formatCombo(prefs.hotkeys.restart)} to restart`}
      </p>

      <AnimatePresence>
        {newAchievements.length > 0 && <AchievementToast keys={newAchievements} />}
      </AnimatePresence>
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
    <label className="flex items-center gap-2 text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-fg"
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
