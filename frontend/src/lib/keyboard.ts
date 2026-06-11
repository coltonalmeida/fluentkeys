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

/** Maps every typeable character to its physical key and whether Shift is needed. */
export const CHAR_TO_KEY: Readonly<Record<string, CharTarget>> = (() => {
  const map: Record<string, CharTarget> = {}
  for (const row of KEY_ROWS) {
    for (const key of row) {
      if (key.modifier) continue
      if (key.id === 'space') {
        map[' '] = { keyId: key.id, shift: false, finger: key.finger }
        continue
      }
      if (/^[a-z]$/.test(key.id)) {
        map[key.id] = { keyId: key.id, shift: false, finger: key.finger }
        map[key.id.toUpperCase()] = { keyId: key.id, shift: true, finger: key.finger }
      } else {
        map[key.id] = { keyId: key.id, shift: false, finger: key.finger }
        if (key.shiftLegend) {
          map[key.shiftLegend] = { keyId: key.id, shift: true, finger: key.finger }
        }
      }
    }
  }
  return map
})()

/** The Shift key pressed by the hand opposite to the one typing the character. */
export function shiftKeyFor(finger: Finger): string {
  return finger.startsWith('l') ? 'rshift' : 'lshift'
}
