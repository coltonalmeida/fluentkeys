import { Router, type NextFunction, type Request, type Response } from 'express'
import { pool } from './db.js'
import { cacheDel, cacheGet, cacheSet } from './redis.js'

const KEY_SETS = ['home', 'home-top', 'all'] as const
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
const WINDOWS = ['all', 'day', 'week'] as const
type Window = (typeof WINDOWS)[number]

const CACHE_TTL_SECONDS = 60
const TOP_N = 50

const cacheKey = (keySet: string, difficulty: string, window: string) =>
  `lb:${keySet}:${difficulty}:${window}`

/** Drop all cached windows for a mode — called when a new entry lands. */
export const invalidateLeaderboard = (keySet: string, difficulty: string) =>
  cacheDel(WINDOWS.map((w) => cacheKey(keySet, difficulty, w)))

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

const WINDOW_SQL: Record<Window, string> = {
  all: '',
  day: `AND l.created_at > now() - interval '1 day'`,
  week: `AND l.created_at > now() - interval '7 days'`,
}

export const leaderboardRouter = Router()

// Public — no auth required to view the leaderboard.
leaderboardRouter.get(
  '/leaderboard',
  wrap(async (req, res) => {
    const keySet = String(req.query.keySet ?? 'all')
    const difficulty = String(req.query.difficulty ?? 'medium')
    const window = String(req.query.window ?? 'all') as Window
    if (
      !(KEY_SETS as readonly string[]).includes(keySet) ||
      !(DIFFICULTIES as readonly string[]).includes(difficulty) ||
      !WINDOWS.includes(window)
    ) {
      res.status(400).json({ error: 'Invalid keySet, difficulty, or window' })
      return
    }

    const key = cacheKey(keySet, difficulty, window)
    const cached = await cacheGet(key)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      res.json(JSON.parse(cached))
      return
    }

    // Best entry per user, top N by wpm. Uses the leaderboard sort index.
    const { rows } = await pool.query(
      `SELECT username, wpm, accuracy, created_at FROM (
         SELECT DISTINCT ON (l.user_id)
                u.username, l.wpm, l.accuracy, l.created_at
         FROM leaderboard_entries l
         JOIN users u ON u.id = l.user_id
         WHERE l.key_set = $1 AND l.difficulty = $2 ${WINDOW_SQL[window]}
         ORDER BY l.user_id, l.wpm DESC, l.created_at DESC
       ) best
       ORDER BY wpm DESC, created_at ASC
       LIMIT $3`,
      [keySet, difficulty, TOP_N],
    )

    const payload = { entries: rows }
    await cacheSet(key, JSON.stringify(payload), CACHE_TTL_SECONDS)
    res.setHeader('X-Cache', 'MISS')
    res.json(payload)
  }),
)
