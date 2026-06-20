// i18n setup (i18next + react-i18next). UI strings are centralized in locales/*.
// English is the source; de/es/fr/pt provide full UI translations (§23). The
// initial language is read from saved preferences to avoid a flash of English.

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { loadPreferences } from './lib/preferences'
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import pt from './locales/pt.json'

export const resources = {
  en: { translation: en },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
  pt: { translation: pt },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: loadPreferences().language,
  fallbackLng: 'en', // missing keys in a locale fall back to English
  interpolation: { escapeValue: false }, // React already escapes
})

export default i18n
