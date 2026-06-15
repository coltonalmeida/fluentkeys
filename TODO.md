# Typing Practice Website — TODO

---

## 1. Layout & Collision Fixes

Ensure blocks are properly separated with no overlap at any viewport size.

- [ ] Audit current layout for overlapping elements (keyboard UI, typing test box, stats bar, etc.)
- [ ] Add explicit gap/margin between the typing test text box and the keyboard visual — never let them share space
- [ ] Wrap each major block (test box, keyboard, stats) in its own bounded container with a defined min-height
- [ ] Set `overflow: hidden` or `overflow: visible` intentionally per section — no implicit bleed
- [ ] Add a visible or invisible divider/spacer between the test box and keyboard (e.g. a `<hr>` or `div` with fixed height)
- [ ] Test layout at narrow viewports (tablet/mobile) to confirm no collisions under compression
- [ ] Verify z-index stack is clean — no absolutely-positioned elements clipping over siblings unintentionally
- [ ] Reference keybr.com layout: test text on top, keyboard below, clear vertical rhythm with consistent spacing

---

## 2. Settings Panel & Page

### 2a. Settings Button (UI Entry Point)

- [ ] Add a settings icon button (gear icon) in the right-side option panel on the main page
- [ ] Clicking it navigates to `/settings` (its own page/route — see Section 4)
- [ ] Button should be visually consistent with the other right-side nav icons

### 2b. Font Settings

- [ ] Allow user to select the font used in the typing test text box
- [ ] Suggested options to expose:
  - `Roboto Mono` (default)
  - `JetBrains Mono`
  - `Fira Code`
  - `IBM Plex Mono`
  - `Source Code Pro`
- [ ] Font preference persists via `localStorage` (no login required) and syncs to user profile if logged in
- [ ] Apply selected font only to the test text box and caret — not the full UI chrome

### 2c. Keyboard Layout Setting

- [ ] Allow user to select their physical keyboard layout; affects the on-screen keyboard visual
- [ ] Layouts to support (phase 1):
  - QWERTY (default)
  - DVORAK
  - AZERTY (common in French-speaking regions)
  - COLEMAK
  - WORKMAN
- [ ] Changing layout re-renders the visual keyboard component with correct key positions and finger color assignments
- [ ] The weak-key algorithm and word generation remain layout-aware (map keys to correct finger assignments per layout)
- [ ] Persist layout preference to user profile / localStorage

### 2d. Website Language (UI Localization)

- [ ] Add a language selector for the website UI — labels, nav items, settings text, error messages
- [ ] The **typing test content always stays in English** regardless of UI language
- [ ] Support the 5 most widely spoken languages (phase 1):
  - English (default)
  - Spanish (Español)
  - French (Français)
  - Portuguese (Português)
  - German (Deutsch)
- [ ] Implement with a lightweight i18n library (e.g. `i18next` with `react-i18next`)
- [ ] Store locale strings in `/locales/{lang}.json` files
- [ ] Language preference persists in localStorage and/or user profile
- [ ] Add a flag or language abbreviation indicator in the UI showing current language

---

## 3. Routing / Page Architecture

Model after keybr.com's multi-page structure. Each section gets its own route. The main page stays clean — navigation to other sections happens via the right-side icon panel.

### 3a. Route Map

| Route | Page | Notes |
|---|---|---|
| `/` | **Practice** (default) | Keyboard + test box + right-side nav panel |
| `/settings` | **Settings** | Font, keyboard layout, language, theme |
| `/profile` | **Profile** | Stats, accuracy history, WPM over time |
| `/leaderboard` | **Leaderboard** | Global/filtered WPM rankings |
| `/help` | **Help / About** | How it works, key weighting explanation |

### 3b. Right-Side Navigation Panel (Main Page)

- [ ] Vertical icon strip on the right side of the main layout (like keybr's sidebar)
- [ ] Each icon links to its corresponding route page
- [ ] Icons: gear (settings), person (profile), trophy (leaderboard), question mark (help)
- [ ] Active route highlights the corresponding icon
- [ ] Panel collapses gracefully on narrow viewports (icons only, no labels; or a hamburger menu fallback)

### 3c. Subdomain Configuration (Optional / Future)

If using actual DNS subdomains instead of routes (e.g. `app.yoursite.com`, `settings.yoursite.com`):

- [ ] Configure Vercel rewrites or wildcard subdomains in `vercel.json`
- [ ] Route each subdomain to the correct React page/component
- [ ] Share auth state (JWT) across subdomains via cross-domain cookie or shared localStorage key
- [ ] **Note:** Routes (`/settings`, `/profile`) are simpler and recommended for v1 — revisit subdomains when the project is closer to production

---

## 4. Settings Page (`/settings`)

Full dedicated settings page — not just a modal. Mirror keybr.com's settings page layout.

- [ ] Sections: Appearance, Keyboard, Language, Account (if logged in)
- [ ] Each section is a clearly separated card or panel — no clutter
- [ ] Live preview of font changes in a small sample text block on the page
- [ ] Live re-render of keyboard layout selector when layout is changed
- [ ] Save button that commits all changes at once (or auto-save per toggle/select)
- [ ] Reset to defaults button per section or globally
- [ ] Settings state managed in a global context (e.g. React Context or Zustand) so the main practice page reacts to changes immediately

---

## 5. Cross-Cutting / Infrastructure

- [ ] Create a `UserPreferences` type in TypeScript covering all settings (font, layout, language, theme)
- [ ] Store preferences in `localStorage` for guest users; sync to Postgres user record for authenticated users
- [ ] On app load, hydrate preferences from localStorage before first render to avoid flash of default styles
- [ ] Write a `usePreferences` hook that exposes current prefs and a setter with persistence side effects
- [ ] Add `PREFERENCES_VERSION` field to the stored object so future schema changes can be migrated gracefully

---

## Reference

- keybr.com source: https://github.com/aradzie/keybr.com
- keybr.com packages of interest: `keybr-keyboard` (layout data), `keybr-intl` (i18n), `keybr-settings` (preferences architecture)
- Layout inspiration: keybr's practice page — clean vertical stack, right sidebar navigation, no overlapping elements
