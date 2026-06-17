import { Lock } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { FINGER_COLORS, FINGER_LABELS, type Finger } from '../lib/keyboard'
import { strengthColor } from '../lib/strengthColor'

// Friendly, plain-language guide meant to make sense to a curious 8-year-old, a
// grandparent trying it for the first time, and everyone in between. Authored in
// English inline (the trainer is English-only for now); full i18n is a follow-up.

const LEGEND_FINGERS: Finger[] = [
  'lPinky',
  'lRing',
  'lMiddle',
  'lIndex',
  'thumb',
  'rIndex',
  'rMiddle',
  'rRing',
  'rPinky',
]

export function HelpPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 text-fg">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold text-fg">
          How FluentKeys works
        </h1>
      </header>

      <Section emoji="⌨️" title="Reading the keyboard">
        <p>
          The on-screen keyboard mirrors a real one. Each key is{' '}
          <strong>colored by the finger</strong> that should press it, so the colors teach
          your hands where to go. The two tiny bumps on <strong>F</strong> and{' '}
          <strong>J</strong> are your home base — rest your index fingers there and your
          other fingers fall into place.
        </p>
        <FingerLegend />
        <p>A few keys look special:</p>
        <ExampleKeys />
      </Section>

      <Section emoji="🔓" title="How new letters unlock">
        <p>
          You begin with the <strong>home row</strong> (A S D F G H J K L). New letters
          appear one at a time, in an order that lets you build real words. To earn the
          next letter, you must bring your <strong>weakest current key</strong> up to a
          strong, steady level.
        </p>
        <p>
          That means the app always pushes you on your trouble spots — not the keys you
          already know. When a key unlocks, it glows and a little message pops up.
        </p>
      </Section>

      <Section emoji="📈" title="How your strength score works">
        <p>
          Every letter has a <strong>strength score from 0 to 100</strong>, shown in the
          panel under the keyboard (weakest first, so your eye lands on what needs work).
          Three things build it: how <strong>accurately</strong> you hit the key, how{' '}
          <strong>quickly</strong> you react, and how <strong>steady</strong> your rhythm
          is.
        </p>
        <StrengthExamples />
        <p>
          Mistakes and slow presses <strong>lower</strong> a letter&rsquo;s score — you can
          lose ground, just like real practice. Type it well again and the score climbs
          back. That&rsquo;s on purpose: it keeps your scores honest and your practice
          focused on what you haven&rsquo;t truly mastered yet.
        </p>
      </Section>

    </div>
  )
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-fg">
        <span aria-hidden className="text-2xl leading-none">
          {emoji}
        </span>
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-base leading-relaxed">{children}</div>
    </section>
  )
}

function FingerLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-surface-2 p-4">
      {LEGEND_FINGERS.map((finger) => (
        <span key={finger} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-4 w-4 rounded"
            style={{ background: FINGER_COLORS[finger].base }}
          />
          {FINGER_LABELS[finger]}
        </span>
      ))}
    </div>
  )
}

/** Tiny mock keys illustrating the three key states the user will notice. */
function ExampleKeys() {
  return (
    <div className="flex flex-wrap gap-5">
      <ExampleKey
        label="Type this next"
        legend="R"
        style={{ background: '#e8e8e8', color: '#18181b' }}
      />
      <ExampleKey
        label="A key you've unlocked"
        legend="F"
        style={{ background: FINGER_COLORS.lIndex.base, color: '#f4f4f5' }}
      />
      <ExampleKey
        label="Not unlocked yet"
        legend="Q"
        style={{ background: '#3f3f46', color: '#a1a1aa' }}
        locked
      />
    </div>
  )
}

function ExampleKey({
  label,
  legend,
  style,
  locked,
}: {
  label: string
  legend: string
  style: CSSProperties
  locked?: boolean
}) {
  return (
    <span className="flex flex-col items-center gap-1.5 text-xs text-muted">
      <span
        className="relative flex h-12 w-12 items-end justify-start rounded-md px-2 pb-1 text-base font-medium"
        style={style}
      >
        {legend}
        {locked && <Lock size={12} className="absolute right-1 top-1 opacity-60" aria-hidden />}
      </span>
      <span className="max-w-[5.5rem] text-center">{label}</span>
    </span>
  )
}

/** Example strength cards mirroring the panel under the keyboard. */
function StrengthExamples() {
  const examples = [
    { letter: 'S', score: 28, note: 'needs work' },
    { letter: 'D', score: 64, note: 'getting there' },
    { letter: 'F', score: 92, note: 'strong' },
  ]
  return (
    <div className="flex flex-wrap gap-4">
      {examples.map(({ letter, score, note }) => (
        <div
          key={letter}
          className="flex w-28 flex-col gap-1.5 rounded-lg bg-surface-2 p-3"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold uppercase text-fg">
              {letter}
            </span>
            <span className="text-sm tabular-nums text-muted">{score}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full"
              style={{ width: `${score}%`, background: strengthColor(score) }}
            />
          </div>
          <span className="text-xs text-muted">{note}</span>
        </div>
      ))}
    </div>
  )
}
