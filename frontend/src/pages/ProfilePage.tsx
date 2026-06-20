import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { AccountPrompt } from '../components/AccountPrompt'
import { LocalProgress } from '../components/LocalProgress'
import { ProgressionCard } from '../components/ProgressionCard'
import { StatsPanel } from '../components/StatsPanel'

export function ProfilePage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
      <SignedIn>
        <ProgressionCard />
        <StatsPanel />
      </SignedIn>
      <SignedOut>
        <LocalProgress />
        <AccountPrompt context="profile" />
      </SignedOut>
    </div>
  )
}
