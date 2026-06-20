import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AchievementToast } from '../components/AchievementToast'
import { KeyboardVisual } from '../components/KeyboardVisual'
import { LetterStrengthPanel } from '../components/LetterStrengthPanel'
import { SessionSummary } from '../components/SessionSummary'
import { TypingArea } from '../components/TypingArea'
import { UnlockToast } from '../components/UnlockToast'
import { BoxLid } from '../components/Unboxing'
import { useHotkeys } from '../hooks/useHotkeys'
import { useIntro } from '../hooks/useIntro'
import { usePreferences } from '../hooks/usePreferences'
import { useTrainer } from '../hooks/useTrainer'
import { formatCombo } from '../lib/hotkeys'
import { getLayout } from '../lib/keyboard'
import { TOTAL_LETTERS } from '../lib/unlocks'

/** Continuous letter-strength trainer — the home experience (typing-training-spec.md). */
export function TrainerPage() {
  const { prefs } = usePreferences()
  const { startIntro, endIntro, hasPlayed, markPlayed } = useIntro()
  const layout = useMemo(() => getLayout(prefs.keyboardLayout), [prefs.keyboardLayout])
  const trainer = useTrainer()

  // The unboxing lid plays once per page load (skipped if already seen this
  // session, so it doesn't replay when navigating back to the home page).
  const [introDone, setIntroDone] = useState(hasPlayed)
  const [flashKeyId, setFlashKeyId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hide the shell header while the lid lifts; restore it when done. Skip
  // entirely once the intro has already played this load.
  useLayoutEffect(() => {
    if (hasPlayed) return
    startIntro()
    return () => endIntro()
  }, [hasPlayed, startIntro, endIntro])

  // Auto-dismiss the unlock toast after 3s (also stops the key pulse).
  const { justUnlocked, clearJustUnlocked } = trainer
  useEffect(() => {
    if (!justUnlocked) return
    const id = setTimeout(() => clearJustUnlocked(), 3000)
    return () => clearTimeout(id)
  }, [justUnlocked, clearJustUnlocked])

  // Auto-dismiss the achievement toast after the session syncs.
  const { newAchievements, clearNewAchievements } = trainer
  useEffect(() => {
    if (newAchievements.length === 0) return
    const id = setTimeout(() => clearNewAchievements(), 3500)
    return () => clearTimeout(id)
  }, [newAchievements, clearNewAchievements])

  // Start/stop via rebindable hotkeys (default Space / Esc). Gated by status so
  // the bound keys only fire when meaningful: begin only from idle after the
  // intro, stop only while running (stopping from idle would pop an empty
  // summary). An undefined handler lets the key fall through to normal typing.
  // Tab restarts the run WITHOUT saving it — an abandoned session never counts
  // (practiceAgain resets to idle; only stop() persists a session). Gated by the
  // intro like startPractice.
  useHotkeys({
    startPractice: introDone && trainer.status === 'idle' ? trainer.begin : undefined,
    stopPractice: trainer.status === 'running' ? trainer.stop : undefined,
    restart: introDone ? trainer.practiceAgain : undefined,
  })

  const handleKey = (key: string) => {
    if (!introDone) return // no typing while the box is still on
    // Until the session is running, swallow typing — the start hotkey (handled by
    // useHotkeys above) arms it; everything else is ignored (no wrong-key flash).
    if (trainer.status !== 'running') return
    // Flash the wrongly-pressed key on the visual keyboard.
    if (key.length === 1 && trainer.nextChar && key !== trainer.nextChar) {
      const pressed = layout.charToKey[key]
      if (pressed) {
        setFlashKeyId(pressed.keyId)
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlashKeyId(null), 200)
      }
    }
    trainer.onKey(key)
  }

  const bleedIn = {
    initial: { opacity: 0, y: 8 },
    animate: introDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
    transition: { duration: 0.6 },
  }

  const finished = trainer.status === 'finished'

  return (
    <div className="flex flex-col gap-6">
      {/* Live stats + stop control. */}
      <motion.div {...bleedIn} className="flex items-center justify-between gap-4 text-sm">
        <div className="flex gap-6">
          <Stat label="WPM" value={trainer.liveWpm} />
          <Stat label="Accuracy" value={`${trainer.accuracy}%`} />
          <Stat label="Words" value={trainer.wordsTyped} />
        </div>
        {trainer.status === 'running' && (
          <div className="flex items-center gap-2 text-xs text-faint">
            <button
              type="button"
              onClick={trainer.stop}
              className="rounded-md border border-border px-3 py-1 text-muted transition-colors hover:bg-surface"
            >
              Stop
            </button>
            <span>
              or{' '}
              <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-fg">
                {formatCombo(prefs.hotkeys.stopPractice)}
              </kbd>
            </span>
            <span>
              ·{' '}
              <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-fg">
                {formatCombo(prefs.hotkeys.restart)}
              </kbd>{' '}
              to restart
            </span>
          </div>
        )}
      </motion.div>

      {/* Practice text. */}
      <motion.section {...bleedIn} className="min-h-[10rem]">
        {!finished && (
          <TypingArea
            target={trainer.line}
            charStates={trainer.charStates}
            index={trainer.index}
            onKey={handleKey}
          />
        )}
      </motion.section>

      <hr className="border-border" />

      {/* Keyboard — strength colors revealed under the lifting lid. */}
      <section className="flex min-h-[18rem] items-start justify-center overflow-visible">
        <div className="relative">
          <KeyboardVisual
            nextChar={introDone && trainer.status === 'running' ? trainer.nextChar : null}
            flashKeyId={flashKeyId}
            showInfo={introDone}
            layout={layout}
            strengthView={{
              unlocked: new Set(trainer.unlocked),
              pulse: trainer.justUnlocked,
            }}
          />
          {!introDone && (
            <BoxLid
              onDone={() => {
                setIntroDone(true)
                endIntro()
                markPlayed()
              }}
            />
          )}
          {introDone && trainer.status === 'idle' && (
            <StartGate onStart={trainer.begin} startKey={prefs.hotkeys.startPractice} />
          )}
        </div>
      </section>

      {/* Letter strength panel. */}
      <motion.div {...bleedIn}>
        <LetterStrengthPanel
          strength={trainer.strengthMap}
          sampleCounts={trainer.sampleCounts}
          unlocked={trainer.unlocked}
          unlockedCount={trainer.unlockedCount}
        />
      </motion.div>

      <AnimatePresence>
        {trainer.justUnlocked && (
          <UnlockToast
            letter={trainer.justUnlocked}
            remaining={TOTAL_LETTERS - trainer.unlockedCount}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newAchievements.length > 0 && <AchievementToast keys={newAchievements} />}
      </AnimatePresence>

      <AnimatePresence>
        {finished && trainer.summary && (
          <SessionSummary summary={trainer.summary} onPracticeAgain={trainer.practiceAgain} />
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Pre-session overlay: blurs the keyboard beneath and prompts the user to begin.
 * Plain CSS (no Framer Motion — reserved for results/leaderboard per CLAUDE.md).
 */
function StartGate({ onStart, startKey }: { onStart: () => void; startKey: string }) {
  return (
    <div className="absolute -inset-3 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-bg/40 backdrop-blur-sm">
      <p className="text-sm uppercase tracking-widest text-muted">
        Press{' '}
        <kbd className="animate-pulse rounded-md border border-border bg-surface px-3 py-1 font-mono text-fg">
          {formatCombo(startKey)}
        </kbd>{' '}
        to start
      </p>
      <button
        type="button"
        onClick={onStart}
        className="rounded-md border border-border bg-surface px-4 py-1.5 text-sm text-fg transition-colors hover:bg-surface-2"
      >
        Start practice
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-2xl tabular-nums text-fg">
        {value}
      </span>
      <span className="text-xs uppercase tracking-wide text-faint">
        {label}
      </span>
    </div>
  )
}
