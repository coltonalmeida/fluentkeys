# Changes — Settings, Routing & Preferences

Implements everything in `TODO.md`: layout fixes, a settings system (font /
keyboard layout / language / theme), multi-page routing with a right-side nav,
a dedicated settings page, and the preferences infrastructure that ties it all
together. Frontend `tsc` + `vite build` pass; all five keyboard layouts are
verified to map every letter to a real key.

## 1. Layout & collision fixes
- The practice page now stacks in bounded blocks with explicit gaps: controls +
  timer, a `min-h-[10rem]` **test box**, an `<hr>` divider, then a
  `min-h-[18rem]` centered **keyboard** block. The two never share space.
- The nav reserves its own space (page has `sm:pr-16` / `pb-14`) so nothing
  overlaps it at any width.

## 2. Settings (font / layout / language)
- **Font** — pick from Roboto Mono, JetBrains Mono, Fira Code, IBM Plex Mono,
  Source Code Pro (loaded via Google Fonts). Applied to the typing box **only**
  through a `--font-test` CSS variable; the UI chrome stays Nunito.
- **Keyboard layout** — QWERTY, Dvorak, Colemak, Workman, AZERTY. Each reuses
  the QWERTY physical frame (positions, widths, finger colors) and just repaints
  the legends, so finger guides and weak-key tracking stay correct.
  See `frontend/src/lib/keyboard.ts` (`getLayout`, `KEYBOARD_LAYOUTS`).
- **Language** — UI localization with `i18next` / `react-i18next` for English,
  Spanish, French, Portuguese, German. Strings live in
  `frontend/src/locales/{lang}.json`. **Typing test content always stays in
  English** (only the chrome translates).

## 3. Routing / pages
- Added `react-router-dom`. Routes: `/` (Practice), `/settings`, `/profile`,
  `/leaderboard`, `/help`; unknown paths fall back to Practice.
- **Right-side nav** (`NavPanel`) — icon rail on desktop, bottom bar on mobile,
  with active-route highlighting. The old header toggles are gone.
- `Leaderboard` and `StatsPanel` now live on their own pages; the profile page
  prompts guests to sign in.

## 4. Settings page (`/settings`)
- Cards for Appearance, Keyboard, Language, Account. Live font preview, live
  keyboard re-render, auto-save on every change, and a Reset-to-defaults button.

## 5. Preferences infrastructure
- `UserPreferences` type + `PREFERENCES_VERSION` and a `normalize`/migrate path
  in `frontend/src/lib/preferences.ts`.
- `usePreferences` context/hook (`frontend/src/hooks/usePreferences.tsx`):
  localStorage is the source of truth; values apply to the DOM (theme class,
  `--font-test`, document language) and persist on change.
- A pre-render script in `index.html` hydrates theme + font + language **before
  first paint** to avoid a flash of default styles.
- Theme is now part of preferences (the old `useTheme` hook was removed).

## Backend
- New migration `backend/migrations/1718000000002_user-preferences.cjs` adds a
  nullable `preferences jsonb` column to `users`.
- New `GET`/`PUT /auth/preferences` endpoints sync a signed-in user's
  preferences to their profile. Sync is best-effort — a failure never blocks
  local use (localStorage stays authoritative), matching the Redis-cache rule.
- **Run `npm run migrate` in `backend/` to apply the new column.**

## Notes / follow-ups
- KeySet/difficulty option labels still come from the data module in English;
  field labels and all chrome are translated. Easy to localize later if wanted.
- The production JS bundle is ~548 kB (Clerk + Framer Motion + i18n). Fine for
  now; consider route-level code-splitting if it matters.
