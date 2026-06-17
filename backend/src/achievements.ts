import { getAuth } from '@clerk/express'
import { Router, type NextFunction, type Request, type Response } from 'express'
import type { PoolClient } from 'pg'
import { requireSignedIn, upsertUser } from './auth.js'
import { pool } from './db.js'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

/**
 * The achievement keys this app awards. Predicates are evaluated against the
 * user's persisted data (so they recompute correctly after each new result or
 * training session). Labels/descriptions live on the frontend — the backend only
 * needs the keys + the rules. See FEATURE-ROADMAP #5.
 */
export const ACHIEVEMENT_KEYS = [
  'first_100_wpm',
  'seven_day_streak',
  'all_letters',
  'ten_thousand_words',
  'flawless',
] as const

interface Metrics {
  max_wpm: number
  total_words: number
  unlocked: number
  flawless: boolean
  longest_streak: number
}

/**
 * Evaluate achievements for a user inside an open transaction `client`, insert
 * any newly-earned rows (idempotent), and return the keys that were newly
 * awarded this call. Safe to call from the results + training transactions.
 */
export async function evaluateAchievements(
  client: PoolClient,
  userId: string,
): Promise<string[]> {
  const { rows } = await client.query<Metrics>(
    `WITH days AS (
       SELECT DISTINCT (ts)::date AS d FROM (
         SELECT created_at AS ts FROM results WHERE user_id = $1
         UNION ALL
         SELECT started_at AS ts FROM training_sessions WHERE user_id = $1
       ) a
     ),
     grp AS (
       SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS g FROM days
     )
     SELECT
       COALESCE((SELECT MAX(wpm) FROM results WHERE user_id = $1), 0)::float8 AS max_wpm,
       COALESCE((SELECT SUM(words_typed) FROM training_sessions WHERE user_id = $1), 0)::int AS total_words,
       COALESCE((SELECT unlocked_up_to_index FROM training_profiles WHERE user_id = $1), 9)::int AS unlocked,
       EXISTS (
         SELECT 1 FROM results r JOIN test_sessions s ON s.id = r.session_id
         WHERE r.user_id = $1 AND r.accuracy >= 100 AND s.duration >= 30
       ) AS flawless,
       COALESCE((SELECT MAX(cnt) FROM (SELECT COUNT(*) AS cnt FROM grp GROUP BY g) z), 0)::int AS longest_streak`,
    [userId],
  )
  const m = rows[0]!

  const earned: string[] = []
  if (m.max_wpm >= 100) earned.push('first_100_wpm')
  if (m.longest_streak >= 7) earned.push('seven_day_streak')
  if (m.unlocked >= 26) earned.push('all_letters')
  if (m.total_words >= 10000) earned.push('ten_thousand_words')
  if (m.flawless) earned.push('flawless')

  if (earned.length === 0) return []

  const { rows: inserted } = await client.query<{ key: string }>(
    `INSERT INTO achievements (user_id, key)
     SELECT $1, k FROM unnest($2::text[]) AS k
     ON CONFLICT (user_id, key) DO NOTHING
     RETURNING key`,
    [userId, earned],
  )
  return inserted.map((r) => r.key)
}

export const achievementsRouter = Router()
achievementsRouter.use(requireSignedIn)

achievementsRouter.get(
  '/achievements',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const { rows } = await pool.query<{ key: string; earned_at: string }>(
      `SELECT key, earned_at FROM achievements WHERE user_id = $1`,
      [user.id],
    )
    res.json({
      earned: rows.map((r) => ({ key: r.key, earnedAt: r.earned_at })),
    })
  }),
)
