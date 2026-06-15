import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HelpPage } from './pages/HelpPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { PracticePage } from './pages/PracticePage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { TrainerPage } from './pages/TrainerPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Home is the continuous letter-strength trainer. */}
        <Route index element={<TrainerPage />} />
        {/* The original timed test, kept as a secondary mode. */}
        <Route path="test" element={<PracticePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="help" element={<HelpPage />} />
        {/* Unknown routes fall back to the trainer. */}
        <Route path="*" element={<TrainerPage />} />
      </Route>
    </Routes>
  )
}

export default App
