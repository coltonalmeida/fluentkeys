import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { KeyboardVisual } from '../components/KeyboardVisual'
import { LetterStrengthPanel } from '../components/LetterStrengthPanel'
import { SessionSummary } from '../components/SessionSummary'
import { TypingArea } from '../components/TypingArea'
import { UnlockToast } from '../components/UnlockToast'
import { BoxLid } from '../components/Unboxing'
import { useIntro } from '../hooks/useIntro'
import { usePreferences } from '../hooks/usePreferences'
import { useTrainer } from '../hooks/useTrainer'
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

  const handleKey = (key: string) => {
    if (!introDone) return // no typing while the box is still on
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
          <button
            type="button"
            onClick={trainer.stop}
            className="rounded-md border border-zinc-300 px-3 py-1 text-zinc-600 transition-colors hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Stop
          </button>
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

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* Keyboard — strength colors revealed under the lifting lid. */}
      <section className="flex min-h-[18rem] items-start justify-center overflow-visible">
        <div className="relative">
          <KeyboardVisual
            nextChar={introDone ? trainer.nextChar : null}
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
        {finished && trainer.summary && (
          <SessionSummary summary={trainer.summary} onPracticeAgain={trainer.practiceAgain} />
        )}
      </AnimatePresence>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-2xl tabular-nums text-zinc-700 dark:text-zinc-200">
        {value}
      </span>
      <span className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
    </div>
  )
}
