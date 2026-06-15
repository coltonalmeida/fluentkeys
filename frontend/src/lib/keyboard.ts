export type Finger =
  | 'lPinky'
  | 'lRing'
  | 'lMiddle'
  | 'lIndex'
  | 'rIndex'
  | 'rMiddle'
  | 'rRing'
  | 'rPinky'
  | 'thumb'

export const FINGER_LABELS: Record<Finger, string> = {
  lPinky: 'L pinky',
  lRing: 'L ring',
  lMiddle: 'L middle',
  lIndex: 'L index',
  rIndex: 'R index',
  rMiddle: 'R middle',
  rRing: 'R ring',
  rPinky: 'R pinky',
  thumb: 'Thumb',
}

// Muted, desaturated tones so the board reads calm. `modifier` is the
// grayer variant used on Tab/Caps/Shift/Ctrl/Alt/Enter/Backspace.
export const FINGER_COLORS: Record<Finger, { base: string; modifier: string }> = {
  lPinky: { base: '#5f7a5f', modifier: '#46554a' },
  lRing: { base: '#7a7a4f', modifier: '#55553f' },
  lMiddle: { base: '#8a7a3f', modifier: '#5e5536' },
  lIndex: { base: '#4f7a72', modifier: '#3f5550' },
  rIndex: { base: '#8a6470', modifier: '#5e4a52' },
  rMiddle: { base: '#8a7a3f', modifier: '#5e5536' },
  rRing: { base: '#7a7a4f', modifier: '#55553f' },
  rPinky: { base: '#5f7a5f', modifier: '#46554a' },
  thumb: { base: '#8a5248', modifier: '#5e413b' },
}

export interface KeyDef {
  id: string
  legend: string
  /** Symbol produced with Shift held — rendered small above the legend. */
  shiftLegend?: string
  /** Width in keyboard units (1u = one letter key). */
  width: number
  finger: Finger
  modifier?: boolean
}

const k = (
  id: string,
  legend: string,
  finger: Finger,
  opts: { shift?: string; width?: number; modifier?: boolean } = {},
): KeyDef => ({
  id,
  legend,
  shiftLegend: opts.shift,
  width: opts.width ?? 1,
  finger,
  modifier: opts.modifier,
})

// Standard 60% ANSI layout. Finger assignments follow touch-typing convention.
export const KEY_ROWS: KeyDef[][] = [
  [
    k('`', '`', 'lPinky', { shift: '~' }),
    k('1', '1', 'lPinky', { shift: '!' }),
    k('2', '2', 'lRing', { shift: '@' }),
    k('3', '3', 'lMiddle', { shift: '#' }),
    k('4', '4', 'lIndex', { shift: '$' }),
    k('5', '5', 'lIndex', { shift: '%' }),
    k('6', '6', 'rIndex', { shift: '^' }),
    k('7', '7', 'rIndex', { shift: '&' }),
    k('8', '8', 'rMiddle', { shift: '*' }),
    k('9', '9', 'rRing', { shift: '(' }),
    k('0', '0', 'rPinky', { shift: ')' }),
    k('-', '-', 'rPinky', { shift: '_' }),
    k('=', '=', 'rPinky', { shift: '+' }),
    k('backspace', 'Backspace', 'rPinky', { width: 2, modifier: true }),
  ],
  [
    k('tab', 'Tab', 'lPinky', { width: 1.5, modifier: true }),
    k('q', 'Q', 'lPinky'),
    k('w', 'W', 'lRing'),
    k('e', 'E', 'lMiddle'),
    k('r', 'R', 'lIndex'),
    k('t', 'T', 'lIndex'),
    k('y', 'Y', 'rIndex'),
    k('u', 'U', 'rIndex'),
    k('i', 'I', 'rMiddle'),
    k('o', 'O', 'rRing'),
    k('p', 'P', 'rPinky'),
    k('[', '[', 'rPinky', { shift: '{' }),
    k(']', ']', 'rPinky', { shift: '}' }),
    k('\\', '\\', 'rPinky', { shift: '|', width: 1.5 }),
  ],
  [
    k('caps', 'Caps', 'lPinky', { width: 1.75, modifier: true }),
    k('a', 'A', 'lPinky'),
    k('s', 'S', 'lRing'),
    k('d', 'D', 'lMiddle'),
    k('f', 'F', 'lIndex'),
    k('g', 'G', 'lIndex'),
    k('h', 'H', 'rIndex'),
    k('j', 'J', 'rIndex'),
    k('k', 'K', 'rMiddle'),
    k('l', 'L', 'rRing'),
    k(';', ';', 'rPinky', { shift: ':' }),
    k("'", "'", 'rPinky', { shift: '"' }),
    k('enter', 'Enter', 'rPinky', { width: 2.25, modifier: true }),
  ],
  [
    k('lshift', 'Shift', 'lPinky', { width: 2.25, modifier: true }),
    k('z', 'Z', 'lPinky'),
    k('x', 'X', 'lRing'),
    k('c', 'C', 'lMiddle'),
    k('v', 'V', 'lIndex'),
    k('b', 'B', 'lIndex'),
    k('n', 'N', 'rIndex'),
    k('m', 'M', 'rIndex'),
    k(',', ',', 'rMiddle', { shift: '<' }),
    k('.', '.', 'rRing', { shift: '>' }),
    k('/', '/', 'rPinky', { shift: '?' }),
    k('rshift', 'Shift', 'rPinky', { width: 2.75, modifier: true }),
  ],
  [
    k('lctrl', 'Ctrl', 'lPinky', { width: 1.5, modifier: true }),
    k('lalt', 'Alt', 'lPinky', { width: 1.5, modifier: true }),
    k('space', '', 'thumb', { width: 6.25 }),
    k('ralt', 'Alt', 'rPinky', { width: 1.5, modifier: true }),
    k('rctrl', 'Ctrl', 'rPinky', { width: 1.5, modifier: true }),
  ],
]

/** Keys with a tactile home-row bump. */
export const HOME_KEYS: ReadonlySet<string> = new Set(['f', 'j'])

export interface CharTarget {
  keyId: string
  shift: boolean
  finger: Finger
}

/** Derives the character→key map for a set of physical key rows. */
function buildCharToKey(rows: KeyDef[][]): Record<string, CharTarget> {
  const map: Record<string, CharTarget> = {}
  for (const row of rows) {
    for (const key of row) {
      if (key.modifier) continue
      if (key.id === 'space') {
        map[' '] = { keyId: key.id, shift: false, finger: key.finger }
        continue
      }
      const lower = key.legend.toLowerCase()
      if (/^[a-z]$/.test(lower)) {
        map[lower] = { keyId: key.id, shift: false, finger: key.finger }
        map[lower.toUpperCase()] = { keyId: key.id, shift: true, finger: key.finger }
      } else {
        map[key.legend] = { keyId: key.id, shift: false, finger: key.finger }
        if (key.shiftLegend) {
          map[key.shiftLegend] = { keyId: key.id, shift: true, finger: key.finger }
        }
      }
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// Alternate keyboard layouts
//
// Every layout reuses the QWERTY *physical* frame above (key positions, widths,
// finger assignments, home-row bumps). Only the legends printed on the three
// letter/punctuation rows change — the standard way to model Dvorak/Colemak/
// Workman/AZERTY on a single ANSI chassis. Finger color assignments therefore
// stay tied to the physical key, exactly as a real keyboard behaves.
// ---------------------------------------------------------------------------

export type LayoutId = 'qwerty' | 'dvorak' | 'colemak' | 'workman' | 'azerty'

export const KEYBOARD_LAYOUTS: Record<LayoutId, { label: string }> = {
  qwerty: { label: 'QWERTY' },
  dvorak: { label: 'Dvorak' },
  colemak: { label: 'Colemak' },
  workman: { label: 'Workman' },
  azerty: { label: 'AZERTY' },
}

// Physical position ids (QWERTY) for the three rows whose legends a layout may
// move. The number row and modifier keys are identical across these layouts.
const ROW_TOP_IDS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'] as const
const ROW_HOME_IDS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"] as const
const ROW_BOTTOM_IDS = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'] as const

interface LayoutLegends {
  top: string[]
  home: string[]
  bottom: string[]
}

// Each entry lists the legend shown at the position ids above, in order.
const LAYOUT_LEGENDS: Record<LayoutId, LayoutLegends> = {
  qwerty: {
    top: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
    home: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
    bottom: ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
  },
  dvorak: {
    top: ["'", ',', '.', 'p', 'y', 'f', 'g', 'c', 'r', 'l', '/', '='],
    home: ['a', 'o', 'e', 'u', 'i', 'd', 'h', 't', 'n', 's', '-'],
    bottom: [';', 'q', 'j', 'k', 'x', 'b', 'm', 'w', 'v', 'z'],
  },
  colemak: {
    top: ['q', 'w', 'f', 'p', 'g', 'j', 'l', 'u', 'y', ';', '[', ']'],
    home: ['a', 'r', 's', 't', 'd', 'h', 'n', 'e', 'i', 'o', "'"],
    bottom: ['z', 'x', 'c', 'v', 'b', 'k', 'm', ',', '.', '/'],
  },
  workman: {
    top: ['q', 'd', 'r', 'w', 'b', 'j', 'f', 'u', 'p', ';', '[', ']'],
    home: ['a', 's', 'h', 't', 'g', 'y', 'n', 'e', 'o', 'i', "'"],
    bottom: ['z', 'x', 'm', 'c', 'v', 'k', 'l', ',', '.', '/'],
  },
  azerty: {
    top: ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
    home: ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'ù'],
    bottom: ['w', 'x', 'c', 'v', 'b', 'n', ',', ';', ':', '!'],
  },
}

// Shift symbols for punctuation that moves between layouts. Letters derive their
// shift legend (the uppercase form) automatically.
const PUNCT_SHIFT: Record<string, string> = {
  ';': ':',
  "'": '"',
  ',': '<',
  '.': '>',
  '/': '?',
  '[': '{',
  ']': '}',
  '-': '_',
  '=': '+',
  '`': '~',
}

function legendFor(raw: string): { legend: string; shiftLegend?: string } {
  if (/^[a-z]$/.test(raw)) return { legend: raw.toUpperCase() }
  return { legend: raw, shiftLegend: PUNCT_SHIFT[raw] }
}

/** Clones the QWERTY frame and repaints the legends for the given layout. */
function applyLegends(layoutId: LayoutId): KeyDef[][] {
  const legends = LAYOUT_LEGENDS[layoutId]
  const override = new Map<string, string>()
  ROW_TOP_IDS.forEach((id, i) => override.set(id, legends.top[i]!))
  ROW_HOME_IDS.forEach((id, i) => override.set(id, legends.home[i]!))
  ROW_BOTTOM_IDS.forEach((id, i) => override.set(id, legends.bottom[i]!))

  return KEY_ROWS.map((row) =>
    row.map((key) => {
      const raw = override.get(key.id)
      if (raw === undefined) return key // number row + modifiers are constant
      return { ...key, ...legendFor(raw) }
    }),
  )
}

export interface KeyboardLayout {
  id: LayoutId
  rows: KeyDef[][]
  charToKey: Readonly<Record<string, CharTarget>>
}

const LAYOUT_CACHE = new Map<LayoutId, KeyboardLayout>()

/** Physical frame + character map for a layout, built once and memoized. */
export function getLayout(id: LayoutId): KeyboardLayout {
  const cached = LAYOUT_CACHE.get(id)
  if (cached) return cached
  const rows = applyLegends(id)
  const layout: KeyboardLayout = { id, rows, charToKey: buildCharToKey(rows) }
  LAYOUT_CACHE.set(id, layout)
  return layout
}

/** Maps every typeable character to its physical key (QWERTY default). */
export const CHAR_TO_KEY: Readonly<Record<string, CharTarget>> = getLayout('qwerty').charToKey

/** The Shift key pressed by the hand opposite to the one typing the character. */
export function shiftKeyFor(finger: Finger): string {
  return finger.startsWith('l') ? 'rshift' : 'lshift'
}
