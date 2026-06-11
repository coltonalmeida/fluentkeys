# Deploying FluentKeys

Phase 8 status: **backend deploy is ready** (Railway or Render). The frontend
(Vercel) is deferred until a domain name is purchased.

## Backend — Render (blueprint included)

`render.yaml` at the repo root provisions the web service + Postgres.

1. Push the repo to GitHub.
2. Render dashboard → **New → Blueprint** → pick this repo. Render reads
   `render.yaml` and creates `fluentkeys-backend` and `fluentkeys-db`.
3. Fill in the `sync: false` env vars when prompted:
   - `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — use **live** keys
     (`pk_live_…` / `sk_live_…`) from dashboard.clerk.com for production.
   - `CORS_ORIGIN` — leave empty for now (allows all origins); set to the
     frontend's https origin once it's deployed.
   - `REDIS_URL` — optional. Leave empty; the leaderboard falls back to
     Postgres. To enable the cache, create a Render **Key Value** instance
     and paste its internal URL.
4. Deploy. Migrations run automatically on each deploy
   (`npm run migrate:prod && npm start`).
5. Verify: `https://<service>.onrender.com/health` returns
   `{"status":"ok","service":"fluentkeys-backend"}`.

## Backend — Railway (alternative)

1. Railway dashboard → **New Project → Deploy from GitHub repo**.
2. Set the service **Root Directory** to `backend`.
3. Add a **PostgreSQL** plugin; reference its URL as `DATABASE_URL`
   (`${{Postgres.DATABASE_URL}}`). Optionally add **Redis** → `REDIS_URL`.
4. Set env vars: `PGSSL=true`, `NODE_ENV=production`, `CLERK_PUBLISHABLE_KEY`,
   `CLERK_SECRET_KEY` (live keys), and later `CORS_ORIGIN`.
5. Build command: `npm ci && npm run build`.
   Start command: `npm run migrate:prod && npm start`.
   Railway injects `PORT` automatically; the server binds `0.0.0.0`.

## Production environment variables (backend)

| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | injected by the platform's Postgres |
| `PGSSL` | yes (`true`) | hosted Postgres requires TLS; off locally |
| `CLERK_PUBLISHABLE_KEY` | yes | live key in production |
| `CLERK_SECRET_KEY` | yes | live key; never committed |
| `CORS_ORIGIN` | once frontend is live | comma-separated allowed origins |
| `REDIS_URL` | no | cache only; app degrades to Postgres |
| `PORT` | injected by platform | defaults to 3001 locally |

If `migrate:prod` fails with a TLS error (some hosted Postgres URLs require
it), append `?sslmode=no-verify` to `DATABASE_URL` — `node-pg-migrate` reads
the connection string directly and doesn't see `PGSSL`.

There is no JWT secret to manage — Clerk owns sessions; the backend only
verifies Clerk session tokens via `@clerk/express`.

## Frontend — Vercel (deferred until domain purchase)

When ready:

1. Vercel → import the repo, **Root Directory** = `frontend`
   (framework preset: Vite).
2. Env vars: `VITE_CLERK_PUBLISHABLE_KEY` (live key) and
   `VITE_API_URL=https://<backend-url>` — production builds call the backend
   directly instead of the dev `/api` proxy.
3. After deploy, set `CORS_ORIGIN` on the backend to the frontend origin and
   add the production domain in the Clerk dashboard (Domains).
