# FluentKeys — Feature Roadmap

In-depth, implementation-ready instructions for the next round of features. Each
section is self-contained: pick one, follow it end-to-end. Effort tags are rough
(**S** ≈ half a day, **M** ≈ 1–2 days, **L** ≈ 3+ days).

The app's core loop is complete (trainer + timed test, personal bests, leaderboard,
activity heatmap, 4 themes, weak-key biasing, Clerk auth, cloud sync). Everything
below is additive.

---

## Conventions (read first — every feature follows these)

- **Theme tokens only.** Style with the semantic classes defined in
  `frontend/src/index.css`: `bg-bg`, `bg-surface`, `bg-surface-2`, `border-border`,
  `text-fg`, `text-muted`, `text-faint`, `text-accent`, `bg-accent`,
  `text-accent-contrast`, `text-error`. **Never** hardcode `zinc-*`/`emerald-*`/hex —
  it breaks the 4 themes. New theme values go in the `THEMES` registry
  (`frontend/src/lib/preferences.ts`) and the `[data-theme]` blocks in `index.css`.
- **Framer Motion** is allowed **only** on the results screen and leaderboard (per
  `CLAUDE.md`). The live caret stays a plain CSS transform — never animate it.
- **No new chart library.** The app ships only `framer-motion` + `lucide-react`.
  Build charts as hand-rolled inline SVG; animate them with Framer on the results
  screen (e.g. `pathLength` draw-in).
- **Auth & writes.** Every write endpoint sits behind `requireSignedIn`
  (`backend/src/auth.ts`); resolve the app user with `upsertUser(clerkId)`. Client
  calls send a Clerk token from `getToken()` — see the `apiRequest` helper in
  `frontend/src/lib/api.ts`.
- **Anonymous persistence is session-only.** If a feature stores client state for
  signed-out users, use `sessionStorage` and mirror the signed-in→`localStorage` /
  anon→`sessionStorage` pattern in `trainingStore.ts` and `preferences.ts`.
- **TypeScript strict; no `any`** in keystroke/WPM logic. Compute WPM/accuracy
  client-side, send to the backend, which sanity-checks rather than recomputing.
- **Schema changes** go through a **new** migration file in `backend/migrations/`
  (timestamp-prefixed, `.cjs`). Never edit an existing migration.
- After any change: `cd frontend && npm run build` (runs `tsc -b` + vite) must pass.

### Key data already captured (reuse before adding)
- `results.char_counts` (JSONB) holds `{ correct, incorrect, keystrokes, miss_<key>: n }`
  — per-key miss counts are **already stored** for every test.
- `GET /weak-keys` aggregates miss counts across the last 50 results.
- `GET /stats/activity` and `/stats/overview` already bucket activity by day/today.
- `letter_strengths` stores `strength_score`, `sample_count`, `last_practiced_at`,
  and `recent_samples` (per-keystroke reaction times) for the trainer.

---

## Recommended build order

1. **#1 WPM-over-time graph** — biggest visible win; mostly client-side.
2. **#6 Live WPM in the timed test** — small; lifts existing trainer logic.
3. **#2 Worst-keys breakdown** — small; data already exists.
4. **#7 Polish bundle** (restart hotkey (add hotkey setting in settings to change all website hotkeys), Caps-Lock warning) — small, high feel.
5. **#3 Progress-over-time chart** — reuses #1's chart component.
6. **#4 Streaks & daily goal**, then **#5 Achievements** — retention.
7. **#8 New practice modes** — content variety.
8. **#9 Strength decay**, **#10 Friends leaderboard** — deeper / larger.

| # | Feature | Effort | Backend? | New deps | Depends on |
|---|---------|:------:|:--------:|:--------:|-----------|
| 1 | WPM-over-time graph | M | optional | no | — |
| 2 | Worst-keys breakdown | S | no | no | — |
| 3 | Progress-over-time chart | M | yes | no | #1 (chart) |
| 4 | Streak + daily goal | M | yes | no | — |
| 5 | Achievements/badges | L | yes | no | #4 (streak data) |
| 6 | Live WPM in test | S | no | no | — |
| 7 | Restart hotkey / Caps-Lock / sounds | S–M | no | no | — |
| 8 | Punctuation/numbers + quotes modes | M | no | no | — |
| 9 | Strength decay | M | yes | no | — |
| 10 | Friends/rivals leaderboard | L | yes | no | user search |

---

## A. Analytics & results

### 1. WPM-over-time graph (results screen) — M

**Goal.** After a timed test, show a line/area chart of WPM across the test, with
markers on seconds where errors happened — the single most-expected feature vs.
Monkeytype/Keybr.

**UX.** On `ResultsScreen`, below the headline numbers: an animated SVG line of WPM
per second (x = elapsed seconds, y = WPM), a fainter raw-WPM line, and small dots/ticks
on error seconds. Draws in via Framer when the results animate in.

**Capture the timeline** (`frontend/src/hooks/useTypingTest.ts`):
- Add a ref `timelineRef = useRef<{ t: number; correct: number; errors: number }[]>([])`
  and counters for cumulative correct chars + per-second errors.
- The countdown effect already ticks every 1s while `status === 'running'`. In that
  tick, push a sample: `{ t: elapsedSec, wpm: (cumulativeCorrectChars/5)/(elapsedSec/60),
  errors: errorsThisSecond }`, then reset the per-second error counter. Track
  cumulative correct from `charStates`/`handleKey`.
- In `finish()`, attach the series to the returned stats (see below).

**Types** (`frontend/src/lib/stats.ts`):
- Add `export interface WpmSample { t: number; wpm: number; raw: number; errors: number }`.
- Either extend the `finish` flow to return `{ stats, timeline }` or add
  `timeline?: WpmSample[]` to `TestStats`. Keep `computeStats` pure; build the timeline
  in the hook and pass it through `PracticePage` → `ResultsScreen`.

**Chart component** (`frontend/src/components/WpmChart.tsx`, new):
- Props: `samples: WpmSample[]`. Pure inline SVG with a `viewBox`; map samples to a
  polyline path; scale Y to `max(wpm)` rounded up. Axis labels in `text-muted`, the
  line in `text-accent` (`stroke="currentColor"` on a `text-accent` element), raw line
  in `text-faint`, error ticks in `text-error`.
- Animate with Framer: `<motion.path pathLength={1} initial={{pathLength:0}} animate=...>`
  (allowed on the results screen).
- Make it responsive: `width="100%"` + fixed `viewBox`, `preserveAspectRatio`.

**Wire-up** (`frontend/src/components/ResultsScreen.tsx`): accept the timeline prop,
render `<WpmChart>` as a Framer `item`. `PracticePage.tsx` passes `timeline` from the
hook into `<ResultsScreen>`.

**Optional persistence.** To show the graph for historical tests, add a migration with
`ALTER TABLE results ADD COLUMN wpm_series JSONB` and include the series in the
`POST /results` body (`backend/src/results.ts`). Mark optional — the live results
screen works without it.

**Reuse.** `computeStats` (`stats.ts`), the existing countdown effect and `charStates`
in `useTypingTest.ts`, Framer patterns in `ResultsScreen.tsx`.

**Acceptance.** Finish a 30s test → an animated WPM curve appears with sensible scale;
error seconds are marked; it renders correctly in all 4 themes and on mobile width.

---

### 2. Per-key "worst keys" breakdown — S

**Goal.** Surface which keys the user misses most, after a test and on the profile.

**UX.** On `ResultsScreen`, a compact "Trouble keys" row: top ~6 missed keys as small
chips sized/colored by miss rate. On `ProfilePage`, a "Weak keys" panel from aggregated
history.

**Data — already exists.** `useTypingTest` returns `missCounts` (per-key miss tally),
already POSTed as `char_counts.miss_<key>`. The `GET /weak-keys` endpoint
(`frontend/src/lib/api.ts: getWeakKeys`) aggregates the last 50 results.

**Frontend.**
- Results: pass `missCounts` into `ResultsScreen`; sort entries desc, render chips with
  `bg-surface-2`/`text-fg`, count in `text-error`.
- Profile: in `StatsPanel.tsx`, call `getWeakKeys(token)` and render the same chip list.
  Reuse the keyboard finger colors (`FINGER_COLORS` in `src/lib/keyboard.ts`) if you
  want per-key tinting.

**Acceptance.** After a test with mistakes, the missed keys show, ordered by frequency;
the profile shows aggregated weak keys for signed-in users.

---

### 3. Progress-over-time chart (Profile) — M

**Goal.** A WPM trend line on the profile (the heatmap shows *when* you practiced, not
*how fast over time*).

**Backend** (`backend/src/stats.ts`): add `GET /stats/wpm-series?days=90` returning
`[{ day, avgWpm, bestWpm }]` grouped by day from `results` (respect the user's tz like
the activity query already does). Guard with `requireSignedIn`.

**Frontend.** Add `getWpmSeries(token)` in `api.ts`; render the **same** `WpmChart`
(or a thin variant) from #1 inside `StatsPanel.tsx` above the heatmap. Add a range
toggle (30/90/365 days) styled like the existing leaderboard selects.

**Reuse.** `WpmChart.tsx` (#1), the tz handling + query patterns in `stats.ts`,
selects styling in `Leaderboard.tsx`.

**Acceptance.** Profile shows a WPM trend that matches recent tests; empty history
renders a friendly empty state, not a broken axis.

---

## B. Retention & gamification

### 4. Daily streak + daily goal — M

**Goal.** A "🔥 N-day streak" indicator and an optional daily goal (minutes or
lessons/day) with a small progress ring.

**Backend** (`backend/src/stats.ts`): add `GET /stats/streak` → `{ current, longest,
todayProgress }`. Compute from per-day activity (the `/stats/activity` query already
buckets sessions by tz-local day) — streak = consecutive days up to today with ≥1
session (or ≥ goal). Keep it a read; no new table needed for the streak itself.

**Preferences** (`frontend/src/lib/preferences.ts`): add `dailyGoal: number` (e.g.
minutes) to `UserPreferences`, with default + `normalizePreferences` validation, and
include it in the existing cloud sync (`PUT /auth/preferences`). Add a control in
`SettingsPage.tsx` (reuse the select/`Field` pattern).

**Frontend.** A `StreakBadge.tsx` (flame icon from lucide + count) in the header
(`Layout.tsx`) for signed-in users and/or on the profile; a progress ring (inline SVG
circle with `stroke-dasharray`) for today's goal. Tokens: `text-accent` for the active
ring, `text-faint` for the track.

**Acceptance.** Practicing on consecutive days increments the streak; the ring fills as
the day's goal is met; goal is configurable and persists.

---

### 5. Achievements / badges — L

**Goal.** Unlockable badges beyond letter unlocks: e.g. *First 100 WPM*, *7-day
streak*, *All 26 letters unlocked*, *10,000 words typed*, *Flawless* (100% accuracy
run ≥30s).

**Schema** (new migration): `achievements (id, user_id FK NOT NULL, key text,
earned_at timestamptz, UNIQUE(user_id, key))`.

**Backend.** A pure `evaluateAchievements(user, context)` module listing definitions
(`key`, `label`, `description`, predicate over result/training/aggregate stats). Call it
inside the existing `POST /results` (`results.ts`) and `POST /training/session`
(`training.ts`) transactions; insert newly-earned rows (`ON CONFLICT DO NOTHING`) and
return `newlyEarned: string[]` in the response. Add `GET /achievements` →
earned + (optionally) all definitions with locked/unlocked state.

**Frontend.** `getAchievements(token)` in `api.ts`; an Achievements grid on
`ProfilePage` (locked = `text-faint`/dimmed, earned = `text-accent` + earned date).
On `newlyEarned`, show a toast — reuse `UnlockToast.tsx` styling/motion.

**Reuse.** `UnlockToast.tsx`, the transaction pattern in `results.ts`, the toast
`AnimatePresence` pattern in `TrainerPage.tsx`.

**Acceptance.** Hitting a milestone inserts the badge once, shows a toast, and the
profile grid reflects earned vs locked.

---

## C. Test feel & polish

### 6. Live WPM during the timed test — S

**Goal.** Show running WPM/accuracy during `/test`, like the trainer already does.

**How.** The trainer computes a rolling live WPM on a 500ms tick (`useTrainer.ts`:
`liveWpm`, `accuracy`). Lift that into `useTypingTest.ts`: track keystroke timestamps,
compute WPM over a ~5s rolling window on a 500ms interval while `running`, expose
`liveWpm`/`liveAccuracy`. Display them in `PracticePage.tsx` next to the timer using the
existing stat styling.

**Reuse.** The live-WPM math in `useTrainer.ts`; the timer/stat layout in
`PracticePage.tsx`.

**Acceptance.** WPM updates smoothly while typing and matches the final number closely;
no jank on the caret (it stays CSS-transform driven).

---

### 7. Restart hotkey + Caps-Lock warning + sound effects — S–M

**Goal.** Faster restarts, a Caps-Lock heads-up, and optional audio feedback.

**Restart hotkey.** In `PracticePage.tsx`/`ResultsScreen.tsx`, listen for Tab or Enter
to call `restart()` (preventDefault; ignore when a Clerk modal/input is focused — match
the existing global key-capture guard in `TypingArea.tsx`). Show the hint near the
existing "press to start" text.

**Caps-Lock warning.** In `TypingArea.tsx`'s key handler, read
`e.getModifierState('CapsLock')`; when true, render a small banner ("⚠ Caps Lock is on")
in `text-error`/`bg-surface`. Clear when it turns off.

<!-- note - dont use sound effects -->
<!-- **Sound effects.** Add `sound: boolean` (and optionally `soundTheme`) to
`preferences.ts` + a toggle in `SettingsPage.tsx`. Create `frontend/src/lib/sound.ts`
+ a `useSound()` helper using the WebAudio API (short click on keypress, a duller tone
on error, a chime on unlock). Gate every play on the pref; lazy-init the
`AudioContext` on first keypress (autoplay policy). Call it from `TypingArea` (key/error)
and the trainer unlock path (`useTrainer.ts`). -->

**Acceptance.** Tab/Enter restarts; Caps-Lock banner toggles with the key; sounds play
only when enabled and never block typing.

---

## D. Content

### 8. Punctuation/numbers mode + quotes/sentences mode — M

**Goal.** More varied practice than lowercase word lists.

**Modes.** Add `mode: 'words' | 'punctuation' | 'numbers' | 'quotes'` to `TestSettings`
(`useTypingTest.ts`) and a selector in `PracticePage.tsx` (reuse the `Selector` there).

**Generation** (`frontend/src/lib/selectWords.ts`):
- *Punctuation*: take the normal weighted word stream and probabilistically capitalize
  sentence starts and append `. , ; ? !` / wrap quotes.
- *Numbers*: interleave random digit groups.
- Keep the weighted weak-key selection (`generateWords`) underneath so biasing still works.

**Quotes** (`frontend/src/lib/quotes.ts`, new): a small bundled array of public-domain
quotes `{ text, author }`. A `pickQuote(targetLen)` returns one near the requested
length; for timed mode, concatenate quotes to fill `wordCountFor(duration)`.

**Notes.** Word/quote content is English-only today (the UI is i18n'd, content isn't) —
state this; non-English content is a separate effort. The trainer (`/`) stays
letter-progression based; these modes are for `/test`.

**Acceptance.** Each mode produces correct target text; weak-key biasing still applies
in words/punctuation/numbers; quotes show attribution on the results screen.

---

## E. Trainer depth

### 9. Strength decay over time — M

**Goal.** Letters you stop practicing slowly fade in strength, so mastery reflects
*current* skill (the original spec deferred this — see the comment in
`backend/src/training.ts`).

**How** (`frontend/src/lib/letterStrength.ts`): add a pure
`applyDecay(strength, lastPracticedAt, now)` (e.g. lose X points per day idle, floored).
Apply on load using `last_practiced_at` from `letter_strengths` when hydrating trainer
state (cloud) and from the local snapshot timestamp for anonymous users. Surface the
(decayed) value in `LetterStrengthPanel.tsx`. Optionally re-evaluate unlock gating on
the decayed value, or only decay display — **decide and document** to avoid surprising
re-locks.

**Reuse.** `computeStrength`/`strengthMapFrom` (`letterStrength.ts`), `last_practiced_at`
in the `letter_strengths` table, the panel rendering.

**Acceptance.** A letter unpracticed for several days shows reduced strength; practicing
it recovers the score; behavior is consistent between signed-in and anonymous.

---

## F. Social

### 10. Friends / rivals leaderboard — L

**Goal.** Compare against chosen users, not just the global top 50.

**Schema** (new migration): `follows (follower_id, followee_id, created_at,
PRIMARY KEY(follower_id, followee_id))`.

**Backend** (`backend/src/leaderboard.ts` + a small users route): `GET /users/search?q=`
(by username, `requireSignedIn`), `POST/DELETE /follows`, and extend the leaderboard
query with `scope=friends` that restricts `leaderboard_entries` to the user's followees
(plus self). The global query already joins `users`; add a `JOIN follows`.

**Frontend** (`Leaderboard.tsx`): a scope toggle (Global / Friends) beside the existing
filters, an "add rival" input (username search → follow), and a remove control. Highlight
the current user (already done) and followed users.

**Reuse.** The existing leaderboard query/filters and selects styling; `requireSignedIn`
+ `upsertUser` patterns.

**Acceptance.** Following a user makes them appear under the Friends scope; the toggle
switches result sets; unfollow removes them. Friends scope is signed-in only (gate with
the existing `AccountPrompt` if accessed anonymously).

---

## Notes

- These descriptions assume the current architecture (semantic theme tokens, Clerk
  auth, the trainer/test split). If you hand a section to an agent, point it at this
  file plus `CLAUDE.md` for the house rules.
- Keep PRs small — one feature (or one sub-bullet) per PR, with `npm run build` green.
