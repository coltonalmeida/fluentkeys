import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DailyChallengePage } from './pages/DailyChallengePage'
import { DuelPage } from './pages/DuelPage'
import { EmbedPage } from './pages/EmbedPage'
import { HelpPage } from './pages/HelpPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { PracticePage } from './pages/PracticePage'
import { ProfilePage } from './pages/ProfilePage'
import { PublicProfilePage } from './pages/PublicProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { SharedResultPage } from './pages/SharedResultPage'
import { TrainerPage } from './pages/TrainerPage'

function App() {
  return (
    <Routes>
      {/* Bare embeddable widget (§5) — rendered outside the app shell (no nav). */}
      <Route path="embed" element={<EmbedPage />} />
      <Route element={<Layout />}>
        {/* Home is the continuous letter-strength trainer. */}
        <Route index element={<TrainerPage />} />
        {/* The original timed test, kept as a secondary mode. */}
        <Route path="test" element={<PracticePage />} />
        {/* Daily challenge: one shared seeded test per day (§9). */}
        <Route path="daily" element={<DailyChallengePage />} />
        {/* Async ghost duel via a shared link (§3). */}
        <Route path="duel/:code" element={<DuelPage />} />
        {/* Shared result page (§1) — interactive view of a shared result. */}
        <Route path="r/:id" element={<SharedResultPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        {/* Public, shareable profile by username (§2). */}
        <Route path="u/:username" element={<PublicProfilePage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="help" element={<HelpPage />} />
        {/* Unknown routes fall back to the trainer. */}
        <Route path="*" element={<TrainerPage />} />
      </Route>
    </Routes>
  )
}

export default App
