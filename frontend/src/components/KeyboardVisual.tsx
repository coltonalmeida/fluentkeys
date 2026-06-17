import { Info, Lock } from 'lucide-react'
import { useState } from 'react'
import {
  FINGER_COLORS,
  FINGER_LABELS,
  HOME_KEYS,
  getLayout,
  shiftKeyFor,
  type Finger,
  type KeyboardLayout,
  type KeyDef,
} from '../lib/keyboard'

const NEXT_KEY_BG = '#e8e8e8'
const FLASH_BG = '#b04040'
const LOCKED_BG = '#3f3f46'

const QWERTY = getLayout('qwerty')

/**
 * Trainer overlay: keys are always colored by finger; this just locks letters
 * the user hasn't unlocked yet and pulses the newest one. (Per-letter strength
 * is shown in the strength panel, not on the keys.)
 */
export interface StrengthView {
  unlocked: ReadonlySet<string>
  /** Letter to pulse after it unlocks. */
  pulse?: string | null
}

interface KeyboardVisualProps {
  /** The character the user must type next; drives the key highlight. */
  nextChar: string | null
  /** Key id to flash red after a wrong press. */
  flashKeyId: string | null
  /** Show the finger-color legend toggle button. */
  showInfo?: boolean
  /** Physical frame + character map to render (defaults to QWERTY). */
  layout?: KeyboardLayout
  /** When set (trainer), lock un-earned letter keys and pulse the newest. */
  strengthView?: StrengthView
}

interface KeyVisual {
  restBg: string
  locked: boolean
  pulse: boolean
}

function letterOf(def: KeyDef): string | null {
  if (def.modifier || def.id === 'space') return null
  const lower = def.legend.toLowerCase()
  return /^[a-z]$/.test(lower) ? lower : null
}

export function KeyboardVisual({
  nextChar,
  flashKeyId,
  showInfo = true,
  layout = QWERTY,
  strengthView,
}: KeyboardVisualProps) {
  const [showLegend, setShowLegend] = useState(false)
  const target = nextChar !== null ? layout.charToKey[nextChar] : undefined
  const highlighted = new Set<string>()
  if (target) {
    highlighted.add(target.keyId)
    if (target.shift) highlighted.add(shiftKeyFor(target.finger))
  }

  const visualFor = (def: KeyDef): KeyVisual => {
    const colors = FINGER_COLORS[def.finger]
    const fingerBg = def.modifier ? colors.modifier : colors.base
    if (!strengthView) return { restBg: fingerBg, locked: false, pulse: false }
    const letter = letterOf(def)
    if (letter && !strengthView.unlocked.has(letter)) {
      return { restBg: LOCKED_BG, locked: true, pulse: false }
    }
    return { restBg: fingerBg, locked: false, pulse: letter ? strengthView.pulse === letter : false }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Only the board defines the centered layout box. The info button is
          positioned absolutely to its right so showing it never shifts the
          keyboard off the center it held during the unboxing animation. */}
      <div className="relative">
        <div
          className="flex flex-col gap-1.5 rounded-xl bg-surface-2 p-3 shadow-lg"
          style={{ ['--u' as string]: '3rem' }}
        >
          {layout.rows.map((row, i) => (
            <div key={i} className="flex gap-1.5">
              {row.map((key) => (
                <Key
                  key={key.id}
                  def={key}
                  isNext={highlighted.has(key.id)}
                  isFlashing={flashKeyId === key.id}
                  visual={visualFor(key)}
                />
              ))}
            </div>
          ))}
        </div>
        {showInfo && (
          <button
            type="button"
            aria-label="Finger color legend"
            onClick={() => setShowLegend((s) => !s)}
            className={`absolute bottom-1 left-full ml-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              showLegend
                ? 'text-accent'
                : 'text-faint hover:text-fg'
            }`}
          >
            <Info size={18} />
          </button>
        )}
      </div>
      {showInfo && (
        <div
          className={`transition-opacity duration-200 ${showLegend ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <Legend />
        </div>
      )}
    </div>
  )
}

function Key({
  def,
  isNext,
  isFlashing,
  visual,
}: {
  def: KeyDef
  isNext: boolean
  isFlashing: boolean
  visual: KeyVisual
}) {
  const isHome = HOME_KEYS.has(def.id)
  const isSpace = def.id === 'space'
  const background = isFlashing ? FLASH_BG : isNext ? NEXT_KEY_BG : visual.restBg
  const textTone = isNext
    ? 'text-zinc-900'
    : def.modifier || visual.locked
      ? 'text-zinc-400'
      : 'text-zinc-100'

  return (
    <div
      className={`relative flex h-12 select-none flex-col items-start justify-end rounded-md px-2 pb-1 transition-colors duration-100 ${textTone} ${
        visual.pulse ? 'key-pulse' : ''
      } ${visual.locked ? 'opacity-50' : ''}`}
      style={{
        // The space bar stretches so the bottom row fills the full board width.
        ...(isSpace ? { flex: 1 } : { width: `calc(var(--u) * ${def.width})` }),
        background,
        filter: isHome && !isNext && !isFlashing ? 'brightness(1.2)' : undefined,
      }}
    >
      {def.shiftLegend && (
        <span className="absolute left-2 top-0.5 text-[0.6rem] leading-none opacity-70">
          {def.shiftLegend}
        </span>
      )}
      <span className={def.modifier ? 'text-xs' : 'text-base font-medium leading-none'}>
        {def.legend}
      </span>
      {visual.locked && (
        <Lock size={12} className="absolute right-1 top-1 opacity-60" aria-hidden />
      )}
      {isHome && (
        <span className="absolute bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-zinc-200/60" aria-hidden />
      )}
    </div>
  )
}

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

function Legend() {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
      {LEGEND_FINGERS.map((finger) => (
        <span key={finger} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: FINGER_COLORS[finger].base }}
          />
          {FINGER_LABELS[finger]}
        </span>
      ))}
    </div>
  )
}
