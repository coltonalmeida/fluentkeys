import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './i18n'
import './index.css'
import App from './App.tsx'
import { IntroProvider } from './hooks/useIntro'
import { PreferencesProvider } from './hooks/usePreferences'
import { ProgressionProvider } from './hooks/useProgression'
import { loadPreferences, THEMES } from './lib/preferences'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY — add it to frontend/.env.local')
}

// Base appearance for Clerk-mounted UI we don't render ourselves (the
// useReverification step-up modal). Per-component appearance (UserButton,
// sign-in/up) is themed reactively via useClerkAppearance; this just gives the
// internal modal a sensible dark/light base matching the persisted theme.
const initialTheme = loadPreferences().theme
const clerkAppearance = THEMES[initialTheme].dark ? { baseTheme: dark } : undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/" appearance={clerkAppearance}>
      <BrowserRouter>
        <PreferencesProvider>
          <ProgressionProvider>
            <IntroProvider>
              <App />
            </IntroProvider>
          </ProgressionProvider>
        </PreferencesProvider>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
)
