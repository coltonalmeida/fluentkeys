import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useClerkAppearance } from '../hooks/useClerkAppearance'
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
  const clerkAppearance = useClerkAppearance()
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
      {/* Reserve bottom space so content clears the floating nav pill. */}
      <div className="pb-24">
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
                <SignInButton mode="modal" appearance={clerkAppearance}>
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
                {/* "Manage account" navigates to our own /settings page instead of
                    opening Clerk's editable modal — all account management (username,
                    emails, connected accounts, password, delete) lives there. */}
                <UserButton
                  appearance={clerkAppearance}
                  userProfileMode="navigation"
                  userProfileUrl="/settings"
                />
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
