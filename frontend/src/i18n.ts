// Lightweight i18n setup (i18next + react-i18next). UI strings only — the
// typing test content always stays in English regardless of the chosen locale.

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import pt from './locales/pt.json'
import { loadPreferences, type LanguageId } from './lib/preferences'

export const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  pt: { translation: pt },
  de: { translation: de },
} as const

// Seed from stored preferences so the first render is already localized.
const initialLanguage: LanguageId = loadPreferences().language

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
})

export default i18n
