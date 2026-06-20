import { useAuth } from '@clerk/clerk-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getProgression, type Progression } from '../lib/api'

interface ProgressionContextValue {
  /** Null while loading or when signed out. */
  progression: Progression | null
  /** Cosmetic ids the user owns (excludes implicit defaults). */
  owned: ReadonlySet<string>
  /** Re-fetch after a result/session that may have changed XP or unlocks. */
  refresh: () => void
}

const ProgressionContext = createContext<ProgressionContextValue | null>(null)

/** Shares the signed-in user's XP/level + owned cosmetics across the app. */
export function ProgressionProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken } = useAuth()
  const [progression, setProgression] = useState<Progression | null>(null)

  const refresh = useCallback(() => {
    if (!isSignedIn) return
    getToken()
      .then((token) => getProgression(token))
      .then(setProgression)
      .catch(() => {})
  }, [isSignedIn, getToken])

  // Load on sign-in; clear on sign-out. The async fetch sets state in a .then
  // (never synchronously), so only the sign-out clear needs the rule waiver.
  useEffect(() => {
    if (!isSignedIn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear cached progression on sign-out
      setProgression(null)
      return
    }
    refresh()
  }, [isSignedIn, refresh])

  const owned = useMemo(
    () => new Set(progression?.ownedCosmetics ?? []),
    [progression],
  )

  return (
    <ProgressionContext.Provider value={{ progression, owned, refresh }}>
      {children}
    </ProgressionContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProgression(): ProgressionContextValue {
  const ctx = useContext(ProgressionContext)
  if (!ctx) throw new Error('useProgression must be used within a ProgressionProvider')
  return ctx
}
