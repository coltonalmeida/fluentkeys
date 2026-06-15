import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { StatsPanel } from '../components/StatsPanel'

export function ProfilePage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
      <SignedIn>
        <StatsPanel />
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-start gap-4 rounded-xl bg-zinc-200/60 p-6 dark:bg-zinc-800/50">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('profile.signInPrompt')}</p>
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-emerald-400"
            >
              {t('header.login')}
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </div>
  )
}
