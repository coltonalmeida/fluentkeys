import { Info } from 'lucide-react'
import { useState } from 'react'
import {
  CHAR_TO_KEY,
  FINGER_COLORS,
  FINGER_LABELS,
  HOME_KEYS,
  KEY_ROWS,
  shiftKeyFor,
  type Finger,
  type KeyDef,
} from '../lib/keyboard'

const NEXT_KEY_BG = '#e8e8e8'
const FLASH_BG = '#b04040'

interface KeyboardVisualProps {
  /** The character the user must type next; drives the key highlight. */
  nextChar: string | null
  /** Key id to flash red after a wrong press. */
  flashKeyId: string | null
}

export function KeyboardVisual({ nextChar, flashKeyId }: KeyboardVisualProps) {
  const [showLegend, setShowLegend] = useState(false)
  const target = nextChar !== null ? CHAR_TO_KEY[nextChar] : undefined
  const highlighted = new Set<string>()
  if (target) {
    highlighted.add(target.keyId)
    if (target.shift) highlighted.add(shiftKeyFor(target.finger))
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-end gap-2">
        <div
          className="flex flex-col gap-1.5 rounded-xl bg-zinc-300 p-3 shadow-lg dark:bg-zinc-800"
          style={{ ['--u' as string]: '3rem' }}
        >
          {KEY_ROWS.map((row, i) => (
            <div key={i} className="flex gap-1.5">
              {row.map((key) => (
                <Key
                  key={key.id}
                  def={key}
                  isNext={highlighted.has(key.id)}
                  isFlashing={flashKeyId === key.id}
                />
              ))}
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-label="Finger color legend"
          onClick={() => setShowLegend((s) => !s)}
          className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
            showLegend
              ? 'text-emerald-500 dark:text-emerald-400'
              : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
          }`}
        >
          <Info size={18} />
        </button>
      </div>
      <div
        className={`transition-opacity duration-200 ${showLegend ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <Legend />
      </div>
    </div>
  )
}

function Key({ def, isNext, isFlashing }: { def: KeyDef; isNext: boolean; isFlashing: boolean }) {
  const colors = FINGER_COLORS[def.finger]
  const isHome = HOME_KEYS.has(def.id)
  const isSpace = def.id === 'space'
  const background = isFlashing ? FLASH_BG : isNext ? NEXT_KEY_BG : def.modifier ? colors.modifier : colors.base

  return (
    <div
      className={`relative flex h-12 select-none flex-col items-start justify-end rounded-md px-2 pb-1 transition-colors duration-100 ${
        isNext ? 'text-zinc-900' : def.modifier ? 'text-zinc-400' : 'text-zinc-100'
      }`}
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
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
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
