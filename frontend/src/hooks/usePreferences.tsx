import { useAuth } from '@clerk/clerk-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import i18n from '../i18n'
import { getPreferences, putPreferences } from '../lib/api'
import {
  DEFAULT_PREFERENCES,
  FONTS,
  loadPreferences,
  normalizePreferences,
  savePreferences,
  THEMES,
  type UserPreferences,
} from '../lib/preferences'

interface PreferencesContextValue {
  prefs: UserPreferences
  /** Patch one or more fields; persists locally and (if signed in) to the profile. */
  update: (patch: Partial<UserPreferences>) => void
  /** Convenience for the theme toggle. */
  toggleTheme: () => void
  /** Reset everything to defaults. */
  reset: () => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

/** Pushes preference values into the DOM (theme class, test font, cosmetics). */
function applyToDocument(prefs: UserPreferences) {
  const root = document.documentElement
  root.dataset.theme = prefs.theme
  root.classList.toggle('dark', THEMES[prefs.theme].dark)
  root.style.setProperty('--font-test', FONTS[prefs.font].stack)
  // Equipped cosmetics drive caret + keyboard-skin styling purely through CSS
  // (data attributes), so the typing components stay preferences-free.
  root.dataset.caret = prefs.equippedCosmetics.caret
  root.dataset.kbSkin = prefs.equippedCosmetics.keyboardSkin
  // UI language (§23).
  root.lang = prefs.language
  if (i18n.language !== prefs.language) void i18n.changeLanguage(prefs.language)
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  // Hydrate synchronously from localStorage so the first paint is correct.
  const [prefs, setPrefs] = useState<UserPreferences>(loadPreferences)
  const { isSignedIn, getToken } = useAuth()
  const remoteLoaded = useRef(false)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reflect into the DOM on every change, and persist to the right store. While
  // Clerk is still resolving (isSignedIn === undefined) we apply the theme but skip
  // the write — otherwise we'd wipe a signed-in user's localStorage cache and flash
  // the default theme. The effect re-runs once isSignedIn settles.
  useEffect(() => {
    applyToDocument(prefs)
    if (isSignedIn === undefined) return
    savePreferences(prefs, isSignedIn === true)
  }, [prefs, isSignedIn])

  // Debounced push to the signed-in user's profile. Failures are swallowed —
  // localStorage stays the source of truth (same rule as the Redis cache).
  const pushRemote = useCallback(
    (next: UserPreferences) => {
      if (!isSignedIn) return
      if (syncTimer.current) clearTimeout(syncTimer.current)
      syncTimer.current = setTimeout(() => {
        getToken()
          .then((token) => putPreferences(token, next))
          .catch(() => {})
      }, 600)
    },
    [isSignedIn, getToken],
  )

  const update = useCallback(
    (patch: Partial<UserPreferences>) => {
      setPrefs((prev) => {
        const next = normalizePreferences({ ...prev, ...patch })
        pushRemote(next)
        return next
      })
    },
    [pushRemote],
  )

  const toggleTheme = useCallback(() => {
    update({ theme: THEMES[prefs.theme].counterpart })
  }, [prefs.theme, update])

  const reset = useCallback(() => {
    const next = { ...DEFAULT_PREFERENCES }
    setPrefs(next)
    pushRemote(next)
  }, [pushRemote])

  // On sign-in, adopt the profile's saved preferences (the profile wins so the
  // same account looks the same on every device). If the profile has none yet,
  // seed it from whatever is stored locally.
  useEffect(() => {
    if (!isSignedIn) {
      remoteLoaded.current = false
      return
    }
    if (remoteLoaded.current) return
    remoteLoaded.current = true
    getToken()
      .then((token) => getPreferences(token))
      .then(({ preferences }) => {
        if (preferences) {
          setPrefs(normalizePreferences(preferences))
        } else {
          setPrefs((current) => {
            pushRemote(current)
            return current
          })
        }
      })
      .catch(() => {})
  }, [isSignedIn, getToken, pushRemote])

  return (
    <PreferencesContext.Provider value={{ prefs, update, toggleTheme, reset }}>
      {children}
    </PreferencesContext.Provider>
  )
}

// Provider + hook are colocated by design (shared context object).
// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider')
  return ctx
}
