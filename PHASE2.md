# Phase 2 — The Typing Test (no backend)

Completed 2026-06-11. A full typing test is now playable locally with no auth
and no persistence, per the CLAUDE.md "Done when" criterion.

## What was built

All code lives in `frontend/src/`. The backend is untouched in this phase.

### Word lists — `lib/words.ts`
- ~190 static English words bundled with the app (no AI, no external API).
- **Key sets**: `home` (asdfghjkl), `home-top` (+ qwertyuiop), `all` (a–z).
  A word is only eligible if every letter is in the active key set.
- **Difficulties**: easy (2–4 letters), medium (4–7), hard (6–14), implemented
  as length filters. If a filter leaves fewer than 10 words, it falls back to
  all typable words so the pool is never empty.

### Weighted selection — `lib/selectWords.ts`
- `generateWords(count, opts)` does roulette-wheel weighted random selection.
- Each word's weight = 1 + (miss count × 2 per weak key) + (1.5 per unlocked
  key it contains). Words with a user's weak keys are therefore more likely.
- Avoids picking the same word twice in a row.
- In Phase 7 this will be fed persisted weak-key history; for now weak keys
  come from misses in the current session (tracked across restarts).

### Stats — `lib/stats.ts`
- `computeStats()` — standard WPM (correct chars ÷ 5 ÷ minutes), raw WPM
  (all typed chars), and accuracy (correct keystrokes ÷ total keystrokes).
  Computed entirely client-side, as the conventions require.

### Test engine — `hooks/useTypingTest.ts`
- State machine: `idle → running → finished`. Timer starts on first
  keystroke; test ends when the countdown hits zero (15/30/60s options).
- Tracks per-character state (`pending`/`correct`/`incorrect`), supports
  backspace, counts every keystroke for accuracy.
- Each miss increments a per-key miss counter (`weakKeysRef`) that persists
  across restarts in the session and biases the next word generation.
- Word count is sized for a ~300 WPM ceiling so the target never runs out.

### Typing area — `components/TypingArea.tsx`
- Renders the target as one `<span>` per character, colored by state
  (dim = pending, white = correct, red underline = incorrect).
- **The live caret is a plain CSS `transform: translate(x, y)`** positioned
  from the current character's measured bounding box in `useLayoutEffect` —
  no Framer Motion, per the critical convention. Framer Motion remains
  reserved for the Phase 3 results screen and Phase 6 leaderboard.
- Captures keystrokes via `onKeyDown` on a focusable div; keeps the active
  line scrolled into view.

### App shell — `App.tsx`
- Settings bar (key set, difficulty, duration selectors) — changing any
  setting regenerates the test.
- On finish, shows WPM / accuracy / raw WPM with a "Try again" button.
  (This is a plain placeholder; the animated results screen is Phase 3.)

## How to run

```sh
cd frontend
npm run dev   # http://localhost:5173 — click the text and type
```

No backend or database needed for this phase.

## Verification done
- `tsc -b` passes (strict mode, no `any` in keystroke/WPM logic).
- Vite dev server compiles and serves the app.

## Notes / next steps
- Phase 3 replaces the plain finish panel with a Framer Motion results screen.
- The temporary `/health` check UI from Phase 1 was replaced by the test UI;
  the backend `/health` route itself is unchanged.
