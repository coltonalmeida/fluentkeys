# FluentKeys

FluentKeys is a full-stack typing-test web app. Take a timed typing test, get
instant WPM and accuracy, and track your personal bests across multiple modes and
difficulties. Sign in to follow rivals and climb a global or friends-only
leaderboard.

It's completely ad-free. What makes it different is the word generator: it runs
entirely on bundled static word lists with a weighted selection algorithm that
biases toward your weak and recently-unlocked keys — no AI and no external API
calls — so each test targets exactly the keys slowing you down. WPM and accuracy
are computed client-side as you type, then validated server-side on completion.

## Tech stack

| Layer | Tooling |
| --- | --- |
| Frontend | [React 19](https://react.dev) · [TypeScript](https://www.typescriptlang.org/) · [Vite](https://vite.dev) · [Tailwind CSS](https://tailwindcss.com) |
| UI & motion | [Framer Motion](https://www.framer.com/motion/) (results + leaderboard only) · [Radix UI](https://www.radix-ui.com/) · [lucide-react](https://lucide.dev) |
| Routing & i18n | [React Router](https://reactrouter.com) · [i18next](https://www.i18next.com/) |
| Auth | [Clerk](https://clerk.com) — `@clerk/clerk-react` + `@clerk/express`, webhooks via [`svix`](https://www.svix.com/) |
| Backend | [Node.js](https://nodejs.org) · [Express](https://expressjs.com) · [TypeScript](https://www.typescriptlang.org/) |
| Database | [PostgreSQL](https://www.postgresql.org/) via [`pg`](https://node-postgres.com/) · migrations with [`node-pg-migrate`](https://github.com/salsita/node-pg-migrate) |
| Hardening | [Helmet](https://helmetjs.github.io/) · [`cors`](https://github.com/expressjs/cors) · [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit) |
| Word generation | Static word lists + weighted selection (no AI, no external API) |
| Testing & lint | [Vitest](https://vitest.dev) · [ESLint](https://eslint.org) |
| Hosting | [Vercel](https://vercel.com) (frontend) · [Render](https://render.com) (backend) · [Supabase](https://supabase.com) (Postgres) |
