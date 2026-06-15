// User preferences: font, keyboard layout, UI language, and theme.
//
// localStorage is the source of truth for everyone (no login required). For
// signed-in users these values also sync to their profile (see usePreferences),
// but a failed sync never blocks local use — same degrade-gracefully rule the
// backend's Redis cache follows.

import type { LayoutId } from './keyboard'
import { KEYBOARD_LAYOUTS } from './keyboard'

export type Theme = 'light' | 'dark'

export type FontId =
  | 'roboto-mono'
  | 'jetbrains-mono'
  | 'fira-code'
  | 'ibm-plex-mono'
  | 'source-code-pro'

export type LanguageId = 'en' | 'es' | 'fr' | 'pt' | 'de'

export interface UserPreferences {
  /** Bumped whenever this shape changes so old stored blobs can be migrated. */
  version: number
  theme: Theme
  font: FontId
  keyboardLayout: LayoutId
  language: LanguageId
}

/** Bump when the stored shape changes; `migrate` handles older versions. */
export const PREFERENCES_VERSION = 1

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

export const LANGUAGES: Record<LanguageId, { label: string; flag: string }> = {
  en: { label: 'English', flag: '🇬🇧' },
  es: { label: 'Español', flag: '🇪🇸' },
  fr: { label: 'Français', flag: '🇫🇷' },
  pt: { label: 'Português', flag: '🇵🇹' },
  de: { label: 'Deutsch', flag: '🇩🇪' },
}

// Re-exported so settings UI lists layouts without importing two modules.
export { KEYBOARD_LAYOUTS }

export const DEFAULT_PREFERENCES: UserPreferences = {
  version: PREFERENCES_VERSION,
  theme: 'dark',
  font: 'roboto-mono',
  keyboardLayout: 'qwerty',
  language: 'en',
}

const FONT_IDS = Object.keys(FONTS) as FontId[]
const LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[]
const LAYOUT_IDS = Object.keys(KEYBOARD_LAYOUTS) as LayoutId[]

/** Coerces an unknown blob into valid preferences, dropping anything invalid. */
export function normalizePreferences(raw: unknown): UserPreferences {
  const p = (raw ?? {}) as Partial<UserPreferences>
  return {
    version: PREFERENCES_VERSION,
    theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : DEFAULT_PREFERENCES.theme,
    font: FONT_IDS.includes(p.font as FontId) ? (p.font as FontId) : DEFAULT_PREFERENCES.font,
    keyboardLayout: LAYOUT_IDS.includes(p.keyboardLayout as LayoutId)
      ? (p.keyboardLayout as LayoutId)
      : DEFAULT_PREFERENCES.keyboardLayout,
    language: LANGUAGE_IDS.includes(p.language as LanguageId)
      ? (p.language as LanguageId)
      : DEFAULT_PREFERENCES.language,
  }
}

/** Reads + validates stored preferences; returns defaults when absent/corrupt. */
export function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { ...DEFAULT_PREFERENCES }
    return normalizePreferences(JSON.parse(stored))
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode / quota — preferences just won't persist this session.
  }
}
