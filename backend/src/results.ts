import { getAuth } from '@clerk/express'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { evaluateAchievements } from './achievements.js'
import { requireSignedIn, upsertUser } from './auth.js'
import { pool } from './db.js'

const KEY_SETS = new Set(['home', 'home-top', 'all'])
const DIFFICULTIES = new Set(['easy', 'medium', 'hard'])
const DURATIONS = new Set([5, 15, 30, 60])

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

interface ResultBody {
  keySet: string
  difficulty: string
  duration: number
  wpm: number
  accuracy: number
  rawWpm: number
  charCounts: Record<string, unknown>
}

/** Sanity-check ranges per CLAUDE.md: trust client stats but reject nonsense. */
function validate(body: unknown): ResultBody | string {
  const b = body as Partial<ResultBody>
  if (typeof b.keySet !== 'string' || !KEY_SETS.has(b.keySet)) return 'Invalid keySet'
  if (typeof b.difficulty !== 'string' || !DIFFICULTIES.has(b.difficulty)) return 'Invalid difficulty'
  if (typeof b.duration !== 'number' || !DURATIONS.has(b.duration)) return 'Invalid duration'
  if (typeof b.wpm !== 'number' || b.wpm < 0 || b.wpm > 400) return 'Invalid wpm'
  if (typeof b.rawWpm !== 'number' || b.rawWpm < 0 || b.rawWpm > 500) return 'Invalid rawWpm'
  if (b.wpm > b.rawWpm + 0.01) return 'wpm cannot exceed rawWpm'
  if (typeof b.accuracy !== 'number' || b.accuracy < 0 || b.accuracy > 100) return 'Invalid accuracy'
  if (typeof b.charCounts !== 'object' || b.charCounts === null) return 'Invalid charCounts'
  return b as ResultBody
}

export const resultsRouter = Router()
resultsRouter.use(requireSignedIn)

resultsRouter.post(
  '/results',
  wrap(async (req, res) => {
    const parsed = validate(req.body)
    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed })
      return
    }
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const session = await client.query<{ id: string }>(
        `INSERT INTO test_sessions (user_id, key_set, difficulty, duration)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [user.id, parsed.keySet, parsed.difficulty, parsed.duration],
      )
      const sessionId = session.rows[0]!.id

      const result = await client.query<{ id: string }>(
        `INSERT INTO results (session_id, user_id, wpm, accuracy, raw_wpm, char_counts)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [sessionId, user.id, parsed.wpm, parsed.accuracy, parsed.rawWpm, parsed.charCounts],
      )
      const resultId = result.rows[0]!.id

      // PB upsert: only replaces when the new wpm is strictly higher.
      const pb = await client.query(
        `INSERT INTO personal_bests (user_id, key_set, difficulty, wpm, accuracy, result_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, key_set, difficulty)
         DO UPDATE SET wpm = EXCLUDED.wpm, accuracy = EXCLUDED.accuracy,
                       result_id = EXCLUDED.result_id, achieved_at = now()
         WHERE EXCLUDED.wpm > personal_bests.wpm
         RETURNING id`,
        [user.id, parsed.keySet, parsed.difficulty, parsed.wpm, parsed.accuracy, resultId],
      )
      await client.query(
        `INSERT INTO leaderboard_entries (user_id, key_set, difficulty, wpm, accuracy)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, parsed.keySet, parsed.difficulty, parsed.wpm, parsed.accuracy],
      )
      const newlyEarned = await evaluateAchievements(client, user.id)
      await client.query('COMMIT')
      res.status(201).json({ resultId, isPersonalBest: pb.rowCount === 1, newlyEarned })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }),
)

resultsRouter.get(
  '/results',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const limit = Math.min(Number(req.query.limit) || 20, 100)
    const { rows } = await pool.query(
      `SELECT r.id, r.wpm, r.accuracy, r.raw_wpm, r.created_at,
              s.key_set, s.difficulty, s.duration
       FROM results r
       JOIN test_sessions s ON s.id = r.session_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [user.id, limit],
    )
    res.json({ results: rows })
  }),
)

// Aggregated per-key miss counts from the user's recent results.
// char_counts stores misses as {"miss_<char>": n}; Phase 7 feeds these
// back into the frontend's weighted word selection.
resultsRouter.get(
  '/weak-keys',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const { rows } = await pool.query<{ key: string; misses: string }>(
      `SELECT kv.key, SUM((kv.value)::numeric)::int AS misses
       FROM (
         SELECT char_counts FROM results
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50
       ) recent,
       LATERAL jsonb_each_text(recent.char_counts) AS kv(key, value)
       WHERE kv.key LIKE 'miss\\_%' ESCAPE '\\'
       GROUP BY kv.key`,
      [user.id],
    )
    const weakKeys: Record<string, number> = {}
    for (const row of rows) {
      weakKeys[row.key.slice('miss_'.length)] = Number(row.misses)
    }
    res.json({ weakKeys })
  }),
)

resultsRouter.get(
  '/personal-bests',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const { rows } = await pool.query(
      `SELECT key_set, difficulty, wpm, accuracy, achieved_at
       FROM personal_bests
       WHERE user_id = $1
       ORDER BY key_set, difficulty`,
      [user.id],
    )
    res.json({ personalBests: rows })
  }),
)
