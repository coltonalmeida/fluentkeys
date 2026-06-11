# CLAUDE.md

Project context for Claude Code. Read this at the start of every session.

## Project

A typing-test web app. Users take typing tests, see results (WPM + accuracy),
track personal bests, and compete on a leaderboard. Word generation is static
(no AI / no token usage) and biases toward a user's weak and unlocked keys.

## Tech Stack

**Frontend**
- React — component architecture (typing area, results, leaderboard)
- TypeScript — strict mode; catches bugs in keystroke logic
- Tailwind — styling
- Framer Motion — results-screen transitions and leaderboard ONLY

**Backend**
- Node.js + Express — REST API for results and leaderboards
- Clerk — authentication (hosted). `@clerk/clerk-react` on the frontend,
  `@clerk/express` middleware verifying Clerk session tokens on the backend.
  No passwords are stored in our database.

**Database**
- PostgreSQL — users, test sessions, results, personal bests, leaderboard entries
- Redis — leaderboard read cache (60s TTL, invalidated on new entries).
  Cache only: every Redis call degrades gracefully to Postgres if Redis is down.

**Word generation (no AI / no token usage)**
- Static word lists bundled with the app, filterable by key set and difficulty
- Weighted selection algorithm — biases toward weak keys and unlocked keys

**Infrastructure**
- Docker — consistent local dev
- Vercel — frontend
- Railway or Render — backend + Postgres

## Critical Conventions

- **The live caret uses a plain CSS transform, never Framer Motion.** It must be
  instant. Framer Motion is reserved for the results screen and leaderboard.
- TypeScript runs in strict mode everywhere. No `any` in keystroke/WPM logic.
- WPM and accuracy are computed client-side during the test, then sent to the
  backend on completion. The backend trusts but validates these (sanity-check
  ranges) rather than recomputing keystroke-by-keystroke.
- Never commit secrets. Clerk keys, DB URLs, etc. live in env vars only.
  (`VITE_CLERK_PUBLISHABLE_KEY` is public by design; `CLERK_SECRET_KEY` is not.)
- The Postgres schema is defined in Phase 0 and is the contract everything else
  depends on. Schema changes go through migrations, not ad-hoc edits.
- Word generation does NOT call any AI or external API. It is purely static
  lists plus the weighted selection function.

## Schema (defined Phase 0, source of truth)

- `users` — id, clerk_id (unique, from Clerk), email, username, created_at.
  Rows are upserted on first authenticated request; Clerk owns credentials.
- `test_sessions` — id, user_id (nullable for anonymous), key_set, difficulty,
  duration, started_at
- `results` — id, session_id, user_id, wpm, accuracy, raw_wpm, char_counts,
  created_at
- `personal_bests` — id, user_id, key_set, difficulty, wpm, accuracy,
  result_id, achieved_at
- `leaderboard_entries` — id, user_id, key_set, difficulty, wpm, accuracy,
  created_at  (indexed on the sort columns)

## Build Order

Each phase is usable on its own. Do not start a later phase before the earlier
one works. Get a playable test running locally (Phases 1–2) before adding any
account/persistence layer.

### Phase 0 — GitHub repo setup
- Decide monorepo vs. two repos
- Create the GitHub repo (do this yourself: github.com → New, or
  `gh repo create`). Claude Code should not create accounts or repos for you.
- Create the project folder under `users/colton almeida/` and initialize the
  project there
- `git init` locally, set the remote, push an initial commit
- Add `.gitignore` (node, env files, build output) and a basic README
- Set the default branch and add a branch-protection rule if desired
**Done when:** the repo exists on GitHub with an initial commit pushed.

### Phase 1 — Foundations
- Repo structure (monorepo or two repos), `.gitignore`, README
- Docker Compose for local Postgres
- Express server with a `/health` route returning JSON
- React + TypeScript + Tailwind frontend booting and hitting `/health` once
- Define the full Postgres schema (above) and a migration setup
- Env var setup (`.env.example`)
**Done when:** frontend boots, backend responds to `/health`, schema migrates cleanly.

### Phase 2 — The typing test (no backend)
- Static word lists, filterable by key set and difficulty
- Weighted selection algorithm (weak keys + unlocked keys)
- Typing area component: render words, capture keystrokes, track correct/
  incorrect characters
- Live caret driven by a plain CSS transform (instant — no Framer Motion)
- Client-side WPM and accuracy computation
**Done when:** a full test is playable locally with no auth and no persistence.

### Phase 3 — Results screen
- Results component displaying Phase 2's computed WPM/accuracy
- Framer Motion transitions for the results screen
- Everything still local
**Done when:** finishing a test animates into a results screen with correct stats.

### Phase 4 — Auth
- Use Clerk for authentication (hosted login/signup, sessions, OAuth, resets). Do NOT roll our own password/JWT logic.
- Frontend: add Clerk's React provider and prebuilt sign-in/sign-up components
- Backend: verify Clerk-issued session tokens in Express middleware on protected routes (this replaces issuing our own JWTs)
- On first sign-in, upsert a row in users keyed by clerk_user_id (Clerk is the identity source; our users row links app data to it)
- One protected route to confirm the token-verification flow end to end
- Store the Clerk publishable/secret keys in env vars only
**Done when:** a user can sign up / log in via Clerk and hit a protected Express
route whose middleware verifies their Clerk session token.

### Phase 5 — Persisting results
- POST results on test completion; store `test_sessions` and `results`
- Compute and update `personal_bests`
- User history + PB views on the frontend
**Done when:** completed tests persist and a logged-in user sees their history and PBs.

### Phase 6 — Leaderboard
- Leaderboard read/write endpoints, backed by an indexed Postgres query
  (index on the sort columns — WPM, time window, key set)
- Leaderboard component with Framer Motion
- implement Redis. Revisit only if read latency is a real measured problem.
**Done when:** results appear on a leaderboard sorted correctly and reads are fast.

### Phase 7 — Refine word generation
- Feed persisted weak-key data back into the weighted selection so it biases
  toward each user's actual weak and unlocked keys
- Requires Phase 5's stored history to be meaningful
**Done when:** word selection visibly adapts to a user's real weak keys.

### Phase 8 — Deploy
- Frontend → Vercel
- Backend + Postgres → Railway or Render
- Production env vars, CORS, production JWT secret
**Done when:** the app is live and the full loop works in production.

## Skills & Plugins

The following skills, plugins, and MCP servers are available for use in this
environment. Use them when relevant — the ones flagged **[relevant]** map
directly to this project's stack.

**`anthropic-skills`**
- `consolidate-memory` — merge/prune memory files
- `docx` — Word document creation/editing
- `pdf` — PDF manipulation
- `pptx` — PowerPoint decks
- `xlsx` — spreadsheets
- `schedule` — scheduled tasks
- `setup-cowork` — guided Cowork setup
- `skill-creator` — create/optimize skills

**`code-review`** — **[relevant: use on every PR / before merge]**
- `code-review` — review a PR / current diff
- `review` — review a pull request
- `simplify` — quality-only cleanup of changed code
- `security-review` — security review of branch changes (esp. Phase 4 auth)

**`feature-dev`** — **[relevant: phased feature work]**
- `feature-dev` — guided feature development
- Subagents: `code-architect`, `code-explorer`, `code-reviewer`

**`vercel`** — **[relevant: frontend deploy, Phase 8]**
- Core: `nextjs`, `turbopack`, `shadcn`, `react-best-practices`,
  `next-upgrade`, `next-cache-components`, `next-forge`, `verification`,
  `bootstrap`, `status`
- Deploy/infra: `deploy`, `deployments-cicd`, `vercel-cli`,
  `vercel-functions`, `routing-middleware`, `runtime-cache`, `vercel-sandbox`
- Env/config: `env`, `env-vars`
- AI: `ai-sdk`, `ai-gateway`, `chat-sdk`, `workflow`, `vercel-agent`
- Storage/services: `vercel-storage`, `marketplace`, `auth`
- Security: `vercel-firewall`
- Misc: `knowledge-update`
- Subagents: `ai-architect`, `deployment-expert`, `performance-optimizer`
- NOTE: this project uses plain React + Vite (not Next.js) per the stack.
  Use the `deploy`, `vercel-cli`, `env`, and `react-best-practices` pieces;
  ignore the Next-specific skills unless we switch to Next.

**`frontend-design`** — **[relevant: building the typing UI]**
- `frontend-design` — distinctive production-grade UI
- `design-taste-frontend` — anti-slop landing pages/portfolios/redesigns

**Standalone skills (not plugin-namespaced)**
- `deep-research` — multi-source fact-checked research reports
- `verify` — run the app and confirm a change works **[relevant: "Done when" checks]**
- `run` — launch/screenshot the project app **[relevant]**
- `update-config` — configure the Claude Code harness (settings.json, hooks, permissions)
- `keybindings-help` — customize keyboard shortcuts
- `fewer-permission-prompts` — build a permission allowlist from transcripts
- `loop` — run a prompt/command on a recurring interval
- `claude-api` — Claude/Anthropic API & SDK reference
- `init` — initialize a CLAUDE.md

**MCP servers (tool integrations, not skills)**
- `context7` — up-to-date library/framework docs **[relevant: React/Express/Tailwind docs]**
- `Claude_Preview` — start/screenshot/click a dev preview **[relevant]**
- `Claude_in_Chrome` — browser automation
- `computer-use` — control the desktop (mouse/keyboard/screenshots)
- `ccd_session` / `ccd_session_mgmt` / `ccd_directory` — session/memory tooling
- `mcp-registry` — discover & suggest MCP connectors
- `scheduled-tasks` — scheduled task management
- `visualize` — render inline SVG/HTML widgets

Suggested usage by phase: `feature-dev` to drive each phase, `verify`/`run`
to confirm "Done when" criteria, `code-review` + `security-review` before
merges (security review matters most at Phase 4 auth), `context7` for current
library docs, and the `vercel` deploy skills at Phase 8.

## Working Agreement

- Confirm which phase we're in before starting work.
- Don't pull work forward from later phases without a reason.
- Ask before destructive actions (dropping tables, force-pushing, deleting data).
- Prefer small, reviewable commits per logical unit.
