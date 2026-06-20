import { Router, type NextFunction, type Request, type Response } from 'express'
import { pool } from './db.js'

// Public, read-only profiles (§2). No auth: anyone can view a user's public
// stats by username. Privacy-trimmed — never exposes email or the Clerk id.

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

interface UserRow {
  id: string
  username: string
  created_at: string
  preferences: { equippedCosmetics?: { badge?: unknown; frame?: unknown } } | null
}

export const profilesRouter = Router()

profilesRouter.get(
  '/users/:username/profile',
  wrap(async (req, res) => {
    const username = String(req.params.username ?? '').trim()
    if (!username || username.length > 64) {
      res.status(400).json({ error: 'Invalid username' })
      return
    }

    const userRes = await pool.query<UserRow>(
      `SELECT id, username, created_at, preferences
       FROM users WHERE lower(username) = lower($1) LIMIT 1`,
      [username],
    )
    const user = userRes.rows[0]
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const [level, totals, pbs, achievements, activity] = await Promise.all([
      pool.query<{ level: number }>(
        `SELECT level FROM user_progression WHERE user_id = $1`,
        [user.id],
      ),
      pool.query<{ top_wpm: number; total_tests: number }>(
        `SELECT COALESCE(MAX(wpm), 0)::float8 AS top_wpm, COUNT(*)::int AS total_tests
         FROM results WHERE user_id = $1`,
        [user.id],
      ),
      pool.query(
        `SELECT key_set, difficulty, wpm, accuracy, achieved_at
         FROM personal_bests WHERE user_id = $1 ORDER BY key_set, difficulty`,
        [user.id],
      ),
      pool.query<{ key: string; earned_at: string }>(
        `SELECT key, earned_at FROM achievements WHERE user_id = $1`,
        [user.id],
      ),
      // Rolling last 12 months of daily activity (UTC), shaped like /stats/activity
      // so the frontend heatmap can render it directly.
      pool.query<{ date: string; tests: number; lessons: number; count: number }>(
        `WITH activity AS (
           SELECT r.created_at AS ts, 'test'::text AS kind FROM results r WHERE r.user_id = $1
           UNION ALL
           SELECT t.started_at AS ts, 'lesson'::text AS kind FROM training_sessions t WHERE t.user_id = $1
         )
         SELECT to_char((ts)::date, 'YYYY-MM-DD') AS date,
                (COUNT(*) FILTER (WHERE kind = 'test'))::int AS tests,
                (COUNT(*) FILTER (WHERE kind = 'lesson'))::int AS lessons,
                COUNT(*)::int AS count
         FROM activity
         WHERE ts >= now() - interval '1 year'
         GROUP BY (ts)::date
         ORDER BY (ts)::date`,
        [user.id],
      ),
    ])

    const equipped = user.preferences?.equippedCosmetics
    const badge = typeof equipped?.badge === 'string' ? equipped.badge : null
    const frame = typeof equipped?.frame === 'string' ? equipped.frame : null

    res.json({
      id: user.id,
      username: user.username,
      joinedAt: user.created_at,
      level: level.rows[0]?.level ?? 1,
      topWpm: totals.rows[0]?.top_wpm ?? 0,
      totalTests: totals.rows[0]?.total_tests ?? 0,
      badge,
      frame,
      pbs: pbs.rows,
      achievements: achievements.rows.map((r) => ({ key: r.key, earnedAt: r.earned_at })),
      activity: activity.rows,
    })
  }),
)
