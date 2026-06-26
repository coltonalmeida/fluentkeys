// User preferences: font, keyboard layout, and theme.
//
// localStorage is the source of truth for everyone (no login required). For
// signed-in users these values also sync to their profile (see usePreferences),
// but a failed sync never blocks local use — same degrade-gracefully rule the
// backend's Redis cache follows.

import { COSMETICS_BY_ID } from './cosmetics'
import type { LayoutId } from './keyboard'
import { KEYBOARD_LAYOUTS } from './keyboard'

// The 4 base themes are free; 'midnight'/'sunset' are earnable cosmetics
// (gated in the picker by ownership) but live in the same `theme` preference.
export type Theme = 'light' | 'dark' | 'coffee' | 'cream' | 'midnight' | 'sunset'

/**
 * Theme registry — single source of truth for the settings picker, the header
 * day/night toggle, and which family drives the `.dark` class.
 * - `dark`: dark-family (toggles the `.dark` class on <html>).
 * - `counterpart`: the paired theme the header ☀/🌙 toggle switches to.
 * - `cosmetic`: when set, the cosmetic id that must be owned to select it.
 */
export const THEMES = {
  light: { label: 'Classic Light', dark: false, counterpart: 'dark' },
  dark: { label: 'Classic Dark', dark: true, counterpart: 'light' },
  coffee: { label: 'Coffee', dark: true, counterpart: 'cream' },
  cream: { label: 'Cream', dark: false, counterpart: 'coffee' },
  midnight: { label: 'Midnight', dark: true, counterpart: 'sunset', cosmetic: 'theme-midnight' },
  sunset: { label: 'Sunset', dark: false, counterpart: 'midnight', cosmetic: 'theme-sunset' },
} as const satisfies Record<
  Theme,
  { label: string; dark: boolean; counterpart: Theme; cosmetic?: string }
>

export type FontId =
  | 'roboto-mono'
  | 'jetbrains-mono'
  | 'fira-code'
  | 'ibm-plex-mono'
  | 'source-code-pro'

/** UI language (§23). Typing tests stay in English; this localizes the interface. */
export type UiLanguage = 'en' | 'de' | 'es' | 'fr' | 'pt'

export const UI_LANGUAGES: Record<UiLanguage, { label: string }> = {
  en: { label: 'English' },
  de: { label: 'Deutsch' },
  es: { label: 'Español' },
  fr: { label: 'Français' },
  pt: { label: 'Português' },
}

/** Language used to generate snippets for the Code typing mode. */
export type CodeLanguage = 'python' | 'javascript' | 'c'

/** Registry for the Settings selector. Python first so it reads as the default. */
export const CODE_LANGUAGES: Record<CodeLanguage, { label: string }> = {
  python: { label: 'Python' },
  javascript: { label: 'JavaScript' },
  c: { label: 'C' },
}

/** Rebindable site hotkeys. Combos are normalized strings (see lib/hotkeys.ts):
 *  modifiers lower-cased + `+`-joined, e.g. "alt+t", "Tab", "shift+Enter". The
 *  nav defaults use Alt so they never collide with the typing capture (which
 *  ignores modifier chords); restart uses Shift+Tab so the bare Tab key is free
 *  to indent in Code mode. */
export type HotkeyAction =
  | 'restart'
  | 'goTrainer'
  | 'goTest'
  | 'goLeaderboard'
  | 'goProfile'
  | 'goSettings'
  | 'startPractice'
  | 'stopPractice'

export const HOTKEYS: Record<HotkeyAction, { label: string; default: string }> = {
  restart: { label: 'Restart test', default: 'shift+Tab' },
  goTrainer: { label: 'Go to Trainer', default: 'alt+h' },
  goTest: { label: 'Go to Timed Test', default: 'alt+t' },
  goLeaderboard: { label: 'Go to Leaderboard', default: 'alt+l' },
  goProfile: { label: 'Go to Profile', default: 'alt+p' },
  goSettings: { label: 'Go to Settings', default: 'alt+s' },
  startPractice: { label: 'Start practice', default: 'Space' },
  stopPractice: { label: 'Stop practice', default: 'Escape' },
}

const HOTKEY_ACTIONS = Object.keys(HOTKEYS) as HotkeyAction[]

/** Equipped cosmetics (§15). caret + keyboardSkin affect the DOM; badge + frame
 *  decorate the profile. Theme cosmetics live in `theme`, not here. */
export interface EquippedCosmetics {
  caret: string
  keyboardSkin: string
  badge: string | null
  frame: string | null
}

export const DEFAULT_EQUIPPED: EquippedCosmetics = {
  caret: 'caret-line',
  keyboardSkin: 'kb-default',
  badge: null,
  frame: null,
}

export interface UserPreferences {
  /** Bumped whenever this shape changes so old stored blobs can be migrated. */
  version: number
  theme: Theme
  font: FontId
  keyboardLayout: LayoutId
  hotkeys: Record<HotkeyAction, string>
  /** Daily practice goal in minutes (drives the streak ring). 0 = no goal. */
  dailyGoal: number
  /** Language for the Code typing mode's snippets. */
  codeLanguage: CodeLanguage
  /** UI language (§23). */
  language: UiLanguage
  /** Equipped cosmetics (§15). */
  equippedCosmetics: EquippedCosmetics
}

/** Bump when the stored shape changes; `migrate` handles older versions. */
export const PREFERENCES_VERSION = 7

/** Selectable daily-goal options, in minutes. */
export const DAILY_GOALS = [0, 5, 10, 15, 30, 60] as const

export function defaultHotkeys(): Record<HotkeyAction, string> {
  const out = {} as Record<HotkeyAction, string>
  for (const a of HOTKEY_ACTIONS) out[a] = HOTKEYS[a].default
  return out
}

const STORAGE_KEY = 'fluentkeys-preferences'

// Each font lists the CSS stack applied to the typing test box (and only the
// box — never the UI chrome). The families load from Google Fonts in index.html.
export const FONTS: Record<FontId, { label: string; stack: string }> = {
  'roboto-mono': { label: 'Roboto Mono', stack: "'Roboto Mono', ui-monospace, monospace" },
  'jetbrains-mono': { label: 'JetBrains Mono', stack: "'JetBrains Mono', ui-monospace, monospace" },
  'fira-code': { label: 'Fira Code', stack: "'Fira Code', ui-monospace, monospace" },
  'ibm-plex-mono': { label: 'IBM Plex Mono', stack: "'IBM Plex Mono', ui-monospace, monospace" },
  'source-code-pro': { label: 'Source Code Pro', stack: "'Source Code Pro', ui-monospace, monospace" },
}

// Re-exported so settings UI lists layouts without importing two modules.
export { KEYBOARD_LAYOUTS }

export const DEFAULT_PREFERENCES: UserPreferences = {
  version: PREFERENCES_VERSION,
  theme: 'dark',
  font: 'roboto-mono',
  keyboardLayout: 'qwerty',
  hotkeys: defaultHotkeys(),
  dailyGoal: 10,
  codeLanguage: 'python',
  language: 'en',
  equippedCosmetics: { ...DEFAULT_EQUIPPED },
}

const THEME_IDS = Object.keys(THEMES) as Theme[]
const FONT_IDS = Object.keys(FONTS) as FontId[]
const LAYOUT_IDS = Object.keys(KEYBOARD_LAYOUTS) as LayoutId[]
const CODE_LANGUAGE_IDS = Object.keys(CODE_LANGUAGES) as CodeLanguage[]
const UI_LANGUAGE_IDS = Object.keys(UI_LANGUAGES) as UiLanguage[]

function normalizeHotkeys(raw: unknown, priorVersion: number): Record<HotkeyAction, string> {
  const r = (raw ?? {}) as Partial<Record<HotkeyAction, unknown>>
  const out = {} as Record<HotkeyAction, string>
  for (const a of HOTKEY_ACTIONS) {
    const v = r[a]
    out[a] = typeof v === 'string' && v.length > 0 ? v : HOTKEYS[a].default
  }
  // v7: restart's default moved Tab → Shift+Tab so the bare Tab key can indent in
  // Code mode. Clear the deprecated Tab default for anyone who never customized it.
  if (priorVersion < 7 && out.restart === 'Tab') out.restart = HOTKEYS.restart.default
  return out
}

/** Coerce a stored cosmetic id to a valid one of the given kind, else fallback. */
function normalizeCosmetic(raw: unknown, kind: string, fallback: string): string {
  if (typeof raw === 'string' && COSMETICS_BY_ID.get(raw)?.kind === kind) return raw
  return fallback
}

function normalizeEquipped(raw: unknown): EquippedCosmetics {
  const e = (raw ?? {}) as Partial<EquippedCosmetics>
  const badge = typeof e.badge === 'string' && COSMETICS_BY_ID.get(e.badge)?.kind === 'badge'
    ? e.badge
    : null
  const frame = typeof e.frame === 'string' && COSMETICS_BY_ID.get(e.frame)?.kind === 'frame'
    ? e.frame
    : null
  return {
    caret: normalizeCosmetic(e.caret, 'caret', DEFAULT_EQUIPPED.caret),
    keyboardSkin: normalizeCosmetic(e.keyboardSkin, 'keyboardSkin', DEFAULT_EQUIPPED.keyboardSkin),
    badge,
    frame,
  }
}

/** Coerces an unknown blob into valid preferences, dropping anything invalid. */
export function normalizePreferences(raw: unknown): UserPreferences {
  const p = (raw ?? {}) as Partial<UserPreferences>
  return {
    version: PREFERENCES_VERSION,
    theme: THEME_IDS.includes(p.theme as Theme) ? (p.theme as Theme) : DEFAULT_PREFERENCES.theme,
    font: FONT_IDS.includes(p.font as FontId) ? (p.font as FontId) : DEFAULT_PREFERENCES.font,
    keyboardLayout: LAYOUT_IDS.includes(p.keyboardLayout as LayoutId)
      ? (p.keyboardLayout as LayoutId)
      : DEFAULT_PREFERENCES.keyboardLayout,
    hotkeys: normalizeHotkeys(p.hotkeys, typeof p.version === 'number' ? p.version : 0),
    dailyGoal: DAILY_GOALS.includes(p.dailyGoal as (typeof DAILY_GOALS)[number])
      ? (p.dailyGoal as number)
      : DEFAULT_PREFERENCES.dailyGoal,
    codeLanguage: CODE_LANGUAGE_IDS.includes(p.codeLanguage as CodeLanguage)
      ? (p.codeLanguage as CodeLanguage)
      : DEFAULT_PREFERENCES.codeLanguage,
    language: UI_LANGUAGE_IDS.includes(p.language as UiLanguage)
      ? (p.language as UiLanguage)
      : DEFAULT_PREFERENCES.language,
    equippedCosmetics: normalizeEquipped(p.equippedCosmetics),
  }
}

/** Reads + validates stored preferences; returns defaults when absent/corrupt.
 *  Signed-in prefs live in localStorage; anonymous prefs in sessionStorage — read
 *  whichever has data (localStorage wins). */
export function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return { ...DEFAULT_PREFERENCES }
    return normalizePreferences(JSON.parse(stored))
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

/** `persistent` (signed-in) → localStorage; anonymous → sessionStorage (cleared at
 *  session end). The other store is cleared so anonymous prefs can't persist. */
export function savePreferences(prefs: UserPreferences, persistent: boolean): void {
  try {
    const [target, other] = persistent
      ? [localStorage, sessionStorage]
      : [sessionStorage, localStorage]
    target.setItem(STORAGE_KEY, JSON.stringify(prefs))
    other.removeItem(STORAGE_KEY)
  } catch {
    // Private mode / quota — preferences just won't persist this session.
  }
}
