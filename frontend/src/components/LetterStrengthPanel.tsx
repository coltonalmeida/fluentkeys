import { Lock } from 'lucide-react'
import { useState } from 'react'
import { strengthColor } from '../lib/strengthColor'
import {
  MIN_SAMPLES_TO_UNLOCK,
  UNLOCK_ORDER,
  UNLOCK_THRESHOLD,
  weakestUnlocked,
} from '../lib/unlocks'
import { CursorHoverCard } from './ui/cursor-hover-card'

interface LetterStrengthPanelProps {
  strength: Record<string, number>
  sampleCounts: Record<string, number>
  unlocked: string[]
  unlockedCount: number
}

type LetterInfo =
  | { kind: 'unlocked'; letter: string; strength: number; reps: number; mastered: boolean; title: string }
  | { kind: 'next'; letter: string; weakest: string; ws: number; wc: number; progressPct: number; title: string }
  | { kind: 'locked'; letter: string; nextLetter: string; title: string }

/**
 * Horizontal strip of per-letter cards (spec §6.3). Unlocked letters are sorted
 * weakest-first; locked letters trail after, grayed out. Hovering any card shows
 * a cursor-following popup: unlocked → strength/reps, the next locked letter →
 * how close it is to unlocking, further locked → "unlock the earlier ones first".
 */
export function LetterStrengthPanel({
  strength,
  sampleCounts,
  unlocked,
  unlockedCount,
}: LetterStrengthPanelProps) {
  const unlockedSet = new Set(unlocked)
  const sorted = [...unlocked].sort((a, b) => (strength[a] ?? 0) - (strength[b] ?? 0))
  const locked = UNLOCK_ORDER.filter((l) => !unlockedSet.has(l))
  const nextLetter = locked[0] ?? null

  const [hovered, setHovered] = useState<string | null>(null)
  // Keep the last hovered letter so its content stays put during the exit fade.
  const [lastLetter, setLastLetter] = useState<string | null>(null)

  const describe = (letter: string): LetterInfo => {
    const idx = UNLOCK_ORDER.indexOf(letter)
    const upper = letter.toUpperCase()
    if (idx < unlockedCount) {
      const s = Math.round(strength[letter] ?? 0)
      const reps = sampleCounts[letter] ?? 0
      const mastered = s >= UNLOCK_THRESHOLD && reps >= MIN_SAMPLES_TO_UNLOCK
      return {
        kind: 'unlocked',
        letter,
        strength: s,
        reps,
        mastered,
        title: mastered
          ? `${upper}: ${s}/100 strength, ${reps} reps — solid.`
          : `${upper}: ${s}/100 strength, ${reps} reps. Reach ${UNLOCK_THRESHOLD} strength & ${MIN_SAMPLES_TO_UNLOCK} reps to help unlock the next key.`,
      }
    }
    if (idx === unlockedCount) {
      const weakest = weakestUnlocked(unlockedCount, strength)
      const ws = Math.round(strength[weakest] ?? 0)
      const wc = sampleCounts[weakest] ?? 0
      const progress = Math.min(ws / UNLOCK_THRESHOLD, wc / MIN_SAMPLES_TO_UNLOCK)
      const progressPct = Math.round(Math.max(0, Math.min(1, progress)) * 100)
      return {
        kind: 'next',
        letter,
        weakest,
        ws,
        wc,
        progressPct,
        title: `Next to unlock. Get your weakest key (${weakest.toUpperCase()}) to ${UNLOCK_THRESHOLD} strength & ${MIN_SAMPLES_TO_UNLOCK} reps — now ${ws}/${UNLOCK_THRESHOLD}, ${wc}/${MIN_SAMPLES_TO_UNLOCK}.`,
      }
    }
    return {
      kind: 'locked',
      letter,
      nextLetter: nextLetter ?? '',
      title: nextLetter ? `Locked — unlock ${nextLetter.toUpperCase()} first.` : 'Locked.',
    }
  }

  const enter = (letter: string) => {
    setHovered(letter)
    setLastLetter(letter)
  }
  const leave = (letter: string) => setHovered((h) => (h === letter ? null : h))

  const shown = lastLetter ? describe(lastLetter) : null

  return (
    <>
      <div className="flex flex-wrap justify-center gap-1.5">
        {sorted.map((letter) => (
          <Card
            key={letter}
            letter={letter}
            score={strength[letter] ?? 0}
            title={describe(letter).title}
            onEnter={() => enter(letter)}
            onLeave={() => leave(letter)}
          />
        ))}
        {locked.map((letter) => (
          <LockedCard
            key={letter}
            letter={letter}
            title={describe(letter).title}
            onEnter={() => enter(letter)}
            onLeave={() => leave(letter)}
          />
        ))}
      </div>
      <CursorHoverCard open={hovered !== null}>
        {shown && <HintBody info={shown} />}
      </CursorHoverCard>
    </>
  )
}

function HintBody({ info }: { info: LetterInfo }) {
  if (info.kind === 'next') {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="text-sm font-semibold text-fg">
          Next to unlock: {info.letter.toUpperCase()}
        </div>
        <div className="text-xs text-muted">
          Bring your weakest key{' '}
          <span className="font-semibold uppercase text-fg">
            {info.weakest}
          </span>{' '}
          to {UNLOCK_THRESHOLD} strength &amp; {MIN_SAMPLES_TO_UNLOCK} reps.
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${info.progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[0.7rem] tabular-nums text-faint">
          <span>
            {info.ws}/{UNLOCK_THRESHOLD} strength
          </span>
          <span>
            {info.wc}/{MIN_SAMPLES_TO_UNLOCK} reps
          </span>
        </div>
      </div>
    )
  }

  if (info.kind === 'locked') {
    return (
      <div className="flex items-center gap-2">
        <Lock size={14} className="shrink-0 text-faint" aria-hidden />
        <span className="text-sm text-muted">
          Unlock <span className="font-semibold uppercase">{info.nextLetter}</span> first
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold uppercase text-fg">
          {info.letter}
        </span>
        <span className="text-xs tabular-nums text-muted">
          {info.strength}/100 · {info.reps} reps
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full"
          style={{ width: `${info.strength}%`, background: strengthColor(info.strength) }}
        />
      </div>
      <div className="text-xs text-muted">
        {info.mastered
          ? 'Solid — keep it up.'
          : `Reach ${UNLOCK_THRESHOLD} strength & ${MIN_SAMPLES_TO_UNLOCK} reps to help unlock the next key.`}
      </div>
    </div>
  )
}

function Card({
  letter,
  score,
  title,
  onEnter,
  onLeave,
}: {
  letter: string
  score: number
  title: string
  onEnter: () => void
  onLeave: () => void
}) {
  const pct = Math.round(Math.min(100, Math.max(0, score)))
  return (
    <div
      title={title}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="flex w-11 flex-col items-center gap-1 rounded-md bg-surface px-1.5 py-1.5"
    >
      <span className="text-sm font-semibold uppercase text-fg">
        {letter}
      </span>
      <span className="text-xs tabular-nums text-muted">{pct}</span>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: strengthColor(score) }} />
      </div>
    </div>
  )
}

function LockedCard({
  letter,
  title,
  onEnter,
  onLeave,
}: {
  letter: string
  title: string
  onEnter: () => void
  onLeave: () => void
}) {
  return (
    <div
      title={title}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="flex w-11 flex-col items-center gap-1 rounded-md bg-surface px-1.5 py-1.5 opacity-50"
    >
      <span className="text-sm font-semibold uppercase text-faint">
        {letter}
      </span>
      <Lock size={11} className="text-faint" aria-hidden />
      <div className="h-1 w-full rounded-full bg-surface-2" />
    </div>
  )
}
