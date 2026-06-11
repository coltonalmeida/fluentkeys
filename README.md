# fluentkeys

A typing-test web app: take tests, see WPM + accuracy, track personal bests, compete on a leaderboard.

## Structure

- `frontend/` — React + TypeScript + Tailwind (Vite)
- `backend/` — Node.js + Express + PostgreSQL
- `docker-compose.yml` — local Postgres

## Local development

```sh
# 1. Env
cp .env.example .env

# 2. Database (requires Docker)
docker compose up -d

# 3. Backend
cd backend
npm install
npm run migrate up   # apply schema
npm run dev          # http://localhost:3001/health

# 4. Frontend (new terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The frontend proxies `/api/*` to the backend in dev.
