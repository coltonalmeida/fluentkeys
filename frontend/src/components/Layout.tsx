import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useHotkeys } from '../hooks/useHotkeys'
import { useIntro } from '../hooks/useIntro'
import { usePreferences } from '../hooks/usePreferences'
import { Cursor } from './Cursor'
import { NavPanel } from './NavPanel'
import { StreakBadge } from './StreakBadge'
import { ThemeToggle } from './ThemeToggle'
import { UsernameGate } from './UsernameGate'

/** App shell: shared header + right-side nav, with the routed page in between. */
export function Layout() {
  const { t } = useTranslation()
  const { prefs, toggleTheme } = usePreferences()
  const navigate = useNavigate()
  // The header icons stay hidden while the home-page box lid is lifting, then
  // bleed in with the rest of the UI. Instant hide, soft fade-in.
  const { introPlaying } = useIntro()

  // Site-wide navigation hotkeys (rebindable in Settings).
  useHotkeys({
    goTrainer: () => navigate('/'),
    goTest: () => navigate('/test'),
    goLeaderboard: () => navigate('/leaderboard'),
    goProfile: () => navigate('/profile'),
    goSettings: () => navigate('/settings'),
  })

  return (
    <div className="min-h-screen bg-bg text-fg">
      <Cursor />
      <SignedIn>
        <UsernameGate />
      </SignedIn>
      {/* Reserve space for the nav: bottom bar on mobile, right rail on sm+. */}
      <div className="pb-14 sm:pb-0 sm:pr-16">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
          <header
            className={`flex items-center justify-between transition-opacity duration-500 ${
              introPlaying ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            <Link
              to="/"
              className="text-3xl font-bold text-accent"
            >
              {t('common.appName')}
            </Link>
            <div className="flex items-center gap-5">
              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="text-sm text-muted underline hover:text-fg"
                  >
                    {t('header.login')}
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <StreakBadge />
                {/* Clerk's "Restrict changes" setting makes the username read-only
                    in the account portal, so our gated Settings editor is the only
                    rename path. The Backend API still updates it, so the
                    once-per-week endpoint keeps working. */}
                <UserButton />
              </SignedIn>
              <ThemeToggle theme={prefs.theme} onToggle={toggleTheme} />
            </div>
          </header>

          <Outlet />
        </div>
      </div>
      <NavPanel />
    </div>
  )
}
