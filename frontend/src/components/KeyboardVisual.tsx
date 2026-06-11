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
  const target = nextChar !== null ? CHAR_TO_KEY[nextChar] : undefined
  const highlighted = new Set<string>()
  if (target) {
    highlighted.add(target.keyId)
    if (target.shift) highlighted.add(shiftKeyFor(target.finger))
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex flex-col gap-1.5 rounded-xl bg-zinc-800 p-3 shadow-lg"
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
      <Legend />
    </div>
  )
}

function Key({ def, isNext, isFlashing }: { def: KeyDef; isNext: boolean; isFlashing: boolean }) {
  const colors = FINGER_COLORS[def.finger]
  const isHome = HOME_KEYS.has(def.id)
  const background = isFlashing ? FLASH_BG : isNext ? NEXT_KEY_BG : def.modifier ? colors.modifier : colors.base

  return (
    <div
      className={`relative flex h-12 select-none flex-col items-center justify-center rounded-md transition-colors duration-100 ${
        isNext ? 'text-zinc-900' : def.modifier ? 'text-zinc-400' : 'text-zinc-100'
      }`}
      style={{
        width: `calc(var(--u) * ${def.width})`,
        background,
        // Home-row keys sit slightly lighter than their finger color.
        filter: isHome && !isNext && !isFlashing ? 'brightness(1.2)' : undefined,
      }}
    >
      {def.shiftLegend && (
        <span className="absolute left-1.5 top-0.5 text-[0.6rem] leading-none opacity-70">
          {def.shiftLegend}
        </span>
      )}
      <span className={def.modifier ? 'text-xs' : 'text-base font-medium'}>{def.legend}</span>
      {isHome && (
        <span className="absolute bottom-1 h-0.5 w-3 rounded-full bg-zinc-200/60" aria-hidden />
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
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-zinc-400">
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
