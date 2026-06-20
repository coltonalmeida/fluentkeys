import { UserButton } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { useMemo, type ComponentProps } from 'react'
import { THEMES, type Theme } from '../lib/preferences'
import { usePreferences } from './usePreferences'

/** Clerk's `appearance` shape, derived from the component prop so it stays in
 *  step with the installed Clerk version without importing @clerk/types. */
type ClerkAppearance = NonNullable<ComponentProps<typeof UserButton>['appearance']>

/** Palette each theme feeds into Clerk's modals. These mirror the per-theme CSS
 *  custom properties in `index.css` (--accent / --surface / --fg / --muted /
 *  --surface-2 / --error). We mirror rather than read them off the DOM because
 *  `data-theme` is applied in an effect (see usePreferences' applyToDocument),
 *  so getComputedStyle during render would lag a theme toggle by one change.
 *  Keep these in sync if the index.css palettes change. */
const THEME_VARS: Record<Theme, ClerkAppearance['variables']> = {
  light: {
    colorPrimary: '#3f3f46',
    colorBackground: '#e4e4e7',
    colorText: '#18181b',
    colorTextSecondary: '#71717a',
    colorInputBackground: '#f4f4f5',
    colorInputText: '#18181b',
    colorDanger: '#ef4444',
  },
  dark: {
    colorPrimary: '#34d399',
    colorBackground: '#27272a',
    colorText: '#f4f4f5',
    colorTextSecondary: '#a1a1aa',
    colorInputBackground: '#1f1f23',
    colorInputText: '#f4f4f5',
    colorDanger: '#f87171',
  },
  coffee: {
    colorPrimary: '#e8a33d',
    colorBackground: '#1f150c',
    colorText: '#e1dcc9',
    colorTextSecondary: '#9a8f7a',
    colorInputBackground: '#2b1e12',
    colorInputText: '#e1dcc9',
    colorDanger: '#f26d6d',
  },
  cream: {
    colorPrimary: '#f62440',
    colorBackground: '#fff2db',
    colorText: '#1f150c',
    colorTextSecondary: '#7a6a52',
    colorInputBackground: '#ffe5bf',
    colorInputText: '#1f150c',
    colorDanger: '#d11d3b',
  },
  midnight: {
    colorPrimary: '#7c5cff',
    colorBackground: '#141a30',
    colorText: '#e6e9f5',
    colorTextSecondary: '#9aa3c0',
    colorInputBackground: '#1b2440',
    colorInputText: '#e6e9f5',
    colorDanger: '#ff6b81',
  },
  sunset: {
    colorPrimary: '#ff5b6e',
    colorBackground: '#ffe7d3',
    colorText: '#3a2417',
    colorTextSecondary: '#8a6a52',
    colorInputBackground: '#ffd9bf',
    colorInputText: '#3a2417',
    colorDanger: '#d11d3b',
  },
}

/** Appearance for Clerk's account / sign-in / sign-up modals that mirrors the
 *  active app theme: a dark base for dark-family themes (Dark, Coffee), plus
 *  accent/background/text variables matched to the current palette. */
export function useClerkAppearance(): ClerkAppearance {
  const { prefs } = usePreferences()
  return useMemo<ClerkAppearance>(
    () => ({
      baseTheme: THEMES[prefs.theme].dark ? dark : undefined,
      variables: THEME_VARS[prefs.theme],
    }),
    [prefs.theme],
  )
}
