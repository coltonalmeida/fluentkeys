import { getAuth } from '@clerk/express'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { upsertUser } from './auth.js'
import { pool } from './db.js'

const KEY_SETS = ['home', 'home-top', 'all'] as const
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
const WINDOWS = ['all', 'day', 'week'] as const
const SCOPES = ['global', 'friends'] as const
type Window = (typeof WINDOWS)[number]

const TOP_N = 50

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
    const scope = String(req.query.scope ?? 'global')
    if (
      !(KEY_SETS as readonly string[]).includes(keySet) ||
      !(DIFFICULTIES as readonly string[]).includes(difficulty) ||
      !WINDOWS.includes(window) ||
      !(SCOPES as readonly string[]).includes(scope)
    ) {
      res.status(400).json({ error: 'Invalid keySet, difficulty, window, or scope' })
      return
    }

    // Friends scope is signed-in only: restrict to the user's followees + self.
    let scopeSql = ''
    const params: (string | number)[] = [keySet, difficulty]
    if (scope === 'friends') {
      const { userId: clerkId } = getAuth(req)
      if (!clerkId) {
        res.status(401).json({ error: 'Sign in to view the friends leaderboard' })
        return
      }
      const me = await upsertUser(clerkId)
      params.push(me.id)
      scopeSql = `AND (l.user_id = $${params.length}
                       OR l.user_id IN (SELECT followee_id FROM follows WHERE follower_id = $${params.length}))`
    }
    params.push(TOP_N)
    const limitParam = `$${params.length}`

    // Best entry per user, top N by wpm. Uses the leaderboard sort index.
    const { rows } = await pool.query(
      `SELECT username, wpm, accuracy, created_at FROM (
         SELECT DISTINCT ON (l.user_id)
                u.username, l.wpm, l.accuracy, l.created_at
         FROM leaderboard_entries l
         JOIN users u ON u.id = l.user_id
         WHERE l.key_set = $1 AND l.difficulty = $2 ${WINDOW_SQL[window]} ${scopeSql}
         ORDER BY l.user_id, l.wpm DESC, l.created_at DESC
       ) best
       ORDER BY wpm DESC, created_at ASC
       LIMIT ${limitParam}`,
      params,
    )

    res.json({ entries: rows })
  }),
)
