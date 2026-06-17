// Lightweight i18n setup (i18next + react-i18next) for the UI strings. The app
// is English-only; this just centralizes the interface copy in one place.

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'

export const resources = {
  en: { translation: en },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
})

export default i18n
