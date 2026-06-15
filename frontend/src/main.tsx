import { ClerkProvider } from '@clerk/clerk-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './i18n'
import './index.css'
import App from './App.tsx'
import { IntroProvider } from './hooks/useIntro'
import { PreferencesProvider } from './hooks/usePreferences'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY — add it to frontend/.env.local')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <BrowserRouter>
        <PreferencesProvider>
          <IntroProvider>
            <App />
          </IntroProvider>
        </PreferencesProvider>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
)
