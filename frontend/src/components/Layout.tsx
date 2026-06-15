import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'
import { useIntro } from '../hooks/useIntro'
import { usePreferences } from '../hooks/usePreferences'
import { Cursor } from './Cursor'
import { NavPanel } from './NavPanel'
import { ThemeToggle } from './ThemeToggle'

/** App shell: shared header + right-side nav, with the routed page in between. */
export function Layout() {
  const { t } = useTranslation()
  const { prefs, toggleTheme } = usePreferences()
  // The header icons stay hidden while the home-page box lid is lifting, then
  // bleed in with the rest of the UI. Instant hide, soft fade-in.
  const { introPlaying } = useIntro()

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      <Cursor />
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
              className="text-3xl font-bold text-emerald-600 dark:text-emerald-400"
            >
              {t('common.appName')}
            </Link>
            <div className="flex items-center gap-5">
              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    {t('header.login')}
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
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
