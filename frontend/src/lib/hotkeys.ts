// Pure helpers for the rebindable-hotkey system. A "combo" is a normalized
// string: modifiers (lower-cased, fixed order) + the key, `+`-joined —
// e.g. "alt+t", "Tab", "shift+Enter", "ctrl+alt+r".

const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Shift', 'Meta'])

/** True while only a modifier is held (used to ignore those during capture). */
export function isModifierOnly(e: KeyboardEvent): boolean {
  return MODIFIER_KEYS.has(e.key)
}

export function comboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  if (e.metaKey) parts.push('meta')
  let key = e.key
  if (key === ' ') key = 'Space'
  if (key.length === 1) key = key.toLowerCase()
  parts.push(key)
  return parts.join('+')
}

const MODIFIER_LABEL: Record<string, string> = {
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
}

/** Friendlier names for a few non-printable keys (Space/Tab already read fine). */
const KEY_LABEL: Record<string, string> = {
  Escape: 'Esc',
}

/** Human-readable combo for the settings UI: "alt+t" → "Alt + T". */
export function formatCombo(combo: string): string {
  return combo
    .split('+')
    .map((p) => MODIFIER_LABEL[p] ?? KEY_LABEL[p] ?? (p.length === 1 ? p.toUpperCase() : p))
    .join(' + ')
}
