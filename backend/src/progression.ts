import { getAuth } from '@clerk/express'
import { Router, type NextFunction, type Request, type Response } from 'express'
import type { PoolClient } from 'pg'
import { requireSignedIn, upsertUser } from './auth.js'
import { unlockedCosmeticIds } from './cosmetics.js'
import { pool } from './db.js'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

// XP/level curve (§16). Cumulative XP to *reach* a level: 50·L·(L−1) →
// L1=0, L2=100, L3=300, L4=600, L5=1000, … A gentle quadratic so early levels
// come fast and later ones stretch out. Mirrored on the frontend (lib/progression).
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1)
}

export function levelForXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level += 1
  return level
}

/** XP boundaries for the current level's progress bar. */
export function levelBounds(xp: number): { level: number; levelXp: number; nextLevelXp: number } {
  const level = levelForXp(xp)
  return { level, levelXp: xpForLevel(level), nextLevelXp: xpForLevel(level + 1) }
}

/**
 * Add XP to a user inside an open transaction and recompute their level.
 * Returns the new totals + whether they leveled up (drives the level-up toast).
 */
export async function awardXp(
  client: PoolClient,
  userId: string,
  amount: number,
): Promise<{ xp: number; level: number; leveledUp: boolean }> {
  const inc = Math.max(0, Math.round(amount))
  const { rows } = await client.query<{ xp: string; level: number }>(
    `INSERT INTO user_progression (user_id, xp, level, updated_at)
     VALUES ($1, $2, 1, now())
     ON CONFLICT (user_id)
     DO UPDATE SET xp = user_progression.xp + $2, updated_at = now()
     RETURNING xp, level`,
    [userId, inc],
  )
  const xp = Number(rows[0]!.xp)
  const prevLevel = rows[0]!.level
  const level = levelForXp(xp)
  if (level !== prevLevel) {
    await client.query(`UPDATE user_progression SET level = $2 WHERE user_id = $1`, [userId, level])
  }
  return { xp, level, leveledUp: level > prevLevel }
}

/** XP earned for one completed timed test (≈ words typed, with a small bonus). */
export function xpForResult(wpm: number, durationSeconds: number): number {
  return Math.round((wpm * durationSeconds) / 60) + 5
}

/** XP earned for a trainer session (words typed + a completion bonus). */
export function xpForTrainingSession(wordsTyped: number): number {
  return wordsTyped + 5
}

interface RewardMetrics {
  level: number
  longest_streak: number
  freeze_milestone: number
  achievements: string[]
}

/**
 * Grant any cosmetics + streak-freeze tokens the user has newly earned. Idempotent
 * and transaction-scoped; call right after awardXp + evaluateAchievements in the
 * result/training transactions. Referral cosmetics are granted explicitly by the
 * referral flow, so `referred` is not derived here.
 */
export async function syncRewards(client: PoolClient, userId: string): Promise<void> {
  const { rows } = await client.query<RewardMetrics>(
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
       COALESCE((SELECT level FROM user_progression WHERE user_id = $1), 1)::int AS level,
       COALESCE((SELECT MAX(cnt) FROM (SELECT COUNT(*) AS cnt FROM grp GROUP BY g) z), 0)::int
         AS longest_streak,
       COALESCE((SELECT freeze_milestone FROM user_progression WHERE user_id = $1), 0)::int
         AS freeze_milestone,
       COALESCE(
         (SELECT array_agg(key) FROM achievements WHERE user_id = $1), '{}'::text[]
       ) AS achievements`,
    [userId],
  )
  const m = rows[0]!

  // Streak-freeze tokens: one per new 7-day milestone of the longest streak.
  const milestone = Math.floor(m.longest_streak / 7)
  if (milestone > m.freeze_milestone) {
    await client.query(
      `UPDATE user_progression
          SET streak_freezes = streak_freezes + $2, freeze_milestone = $3
        WHERE user_id = $1`,
      [userId, milestone - m.freeze_milestone, milestone],
    )
  }

  // Cosmetics whose unlock condition is now met.
  const ids = unlockedCosmeticIds({
    level: m.level,
    longestStreak: m.longest_streak,
    achievements: new Set(m.achievements),
    referred: false,
  })
  if (ids.length > 0) {
    await client.query(
      `INSERT INTO user_cosmetics (user_id, cosmetic_id)
       SELECT $1, c FROM unnest($2::text[]) AS c
       ON CONFLICT (user_id, cosmetic_id) DO NOTHING`,
      [userId, ids],
    )
  }
}

/** Grant a single cosmetic directly (used by the referral flow). */
export async function grantCosmetic(
  client: PoolClient,
  userId: string,
  cosmeticId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO user_cosmetics (user_id, cosmetic_id) VALUES ($1, $2)
     ON CONFLICT (user_id, cosmetic_id) DO NOTHING`,
    [userId, cosmeticId],
  )
}

export const progressionRouter = Router()
progressionRouter.use(requireSignedIn)

progressionRouter.get(
  '/progression',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)

    const [prog, cosmetics] = await Promise.all([
      pool.query<{ xp: string; streak_freezes: number }>(
        `SELECT xp, streak_freezes FROM user_progression WHERE user_id = $1`,
        [user.id],
      ),
      pool.query<{ cosmetic_id: string }>(
        `SELECT cosmetic_id FROM user_cosmetics WHERE user_id = $1`,
        [user.id],
      ),
    ])

    const xp = Number(prog.rows[0]?.xp ?? 0)
    const { level, levelXp, nextLevelXp } = levelBounds(xp)
    res.json({
      xp,
      level,
      levelXp,
      nextLevelXp,
      streakFreezes: prog.rows[0]?.streak_freezes ?? 0,
      ownedCosmetics: cosmetics.rows.map((r) => r.cosmetic_id),
    })
  }),
)
