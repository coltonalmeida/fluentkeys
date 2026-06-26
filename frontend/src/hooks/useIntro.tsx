import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface IntroContextValue {
  /** True while the home-page unboxing animation is lifting. */
  introPlaying: boolean
  /** Called by the home page when the box lid starts covering the keyboard. */
  startIntro: () => void
  /** Called when the lid finishes lifting; the surrounding UI bleeds in. */
  endIntro: () => void
  /** Whether the unboxing has already played during this page load. */
  hasPlayed: boolean
  /** Mark the unboxing as played so it doesn't replay on in-app navigation. */
  markPlayed: () => void
}

const IntroContext = createContext<IntroContextValue | null>(null)

/**
 * Coordinates the one-time unboxing animation. The lid plays once per page load,
 * on the home (practice) page only; `hasPlayed` lives here at the app root so it
 * survives route changes (it resets on a full browser reload). While the lid
 * lifts, `introPlaying` keeps the shared header hidden until it bleeds in.
 *
 * `introPlaying` is seeded synchronously from the initial route: on a fresh home
 * load it starts `true` so the header is hidden on the very first paint, avoiding
 * a one-frame flash before the home page's effect can flip it. The lazy
 * initializer runs once on mount, so in-app navigation never re-triggers it.
 */
export function IntroProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [introPlaying, setIntroPlaying] = useState(() => pathname === '/')
  const [hasPlayed, setHasPlayed] = useState(false)
  const startIntro = useCallback(() => setIntroPlaying(true), [])
  const endIntro = useCallback(() => setIntroPlaying(false), [])
  const markPlayed = useCallback(() => setHasPlayed(true), [])

  return (
    <IntroContext.Provider
      value={{ introPlaying, startIntro, endIntro, hasPlayed, markPlayed }}
    >
      {children}
    </IntroContext.Provider>
  )
}

// Provider + hook colocated by design (shared context object).
// eslint-disable-next-line react-refresh/only-export-components
export function useIntro(): IntroContextValue {
  const ctx = useContext(IntroContext)
  if (!ctx) throw new Error('useIntro must be used within an IntroProvider')
  return ctx
}
