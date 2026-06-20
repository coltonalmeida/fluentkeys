import { getAuth } from '@clerk/express'
import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { requireSignedIn, upsertUser } from './auth.js'
import { pool } from './db.js'

// Daily challenge (§9): one shared, seeded test per UTC day. The backend defines
// the fixed config + a date-derived seed; every client generates identical words
// from that seed (frontend lib/rng.ts mulberry32 + the bundled word pool). Results
// land in their own date-scoped leaderboard, separate from the global one.

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

// Fixed daily format apart from the mode, which cycles across days so the daily
// rotates through every test type. codeLanguage is fixed so code-mode dailies are
// identical for everyone.
const DAILY_BASE = { keySet: 'all', difficulty: 'medium', duration: 30, codeLanguage: 'python' } as const
const DAILY_MODES = ['words', 'punctuation', 'numbers', 'quotes', 'code'] as const

/** The mode for a given UTC date — cycles through DAILY_MODES day by day. */
function modeForDate(date: string): string {
  const dayIndex = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000)
  const i = ((dayIndex % DAILY_MODES.length) + DAILY_MODES.length) % DAILY_MODES.length
  return DAILY_MODES[i]!
}

/** Today's date as 'YYYY-MM-DD' in UTC (the challenge resets at UTC midnight). */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** FNV-1a hash of the date → uint32 seed. Mirrors the frontend's hashSeed. */
function dailySeed(date: string): number {
  let h = 2166136261
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const dailyRouter = Router()

// Today's challenge config + (if signed in) the caller's best for today.
dailyRouter.get(
  '/daily',
  wrap(async (req, res) => {
    const date = todayUtc()
    const { userId: clerkId } = getAuth(req)
    let yourBest: { wpm: number; accuracy: number } | null = null
    if (clerkId) {
      const user = await upsertUser(clerkId)
      const { rows } = await pool.query<{ wpm: string; accuracy: string }>(
        `SELECT wpm, accuracy FROM daily_results WHERE user_id = $1 AND date = $2`,
        [user.id, date],
      )
      if (rows[0]) yourBest = { wpm: Number(rows[0].wpm), accuracy: Number(rows[0].accuracy) }
    }
    res.json({ date, seed: dailySeed(date), mode: modeForDate(date), ...DAILY_BASE, yourBest })
  }),
)

// Date-scoped leaderboard (public). Defaults to today.
dailyRouter.get(
  '/daily/leaderboard',
  wrap(async (req, res) => {
    const raw = typeof req.query.date === 'string' ? req.query.date : ''
    const date = DATE_RE.test(raw) ? raw : todayUtc()
    const { rows } = await pool.query<{
      username: string | null
      wpm: string
      accuracy: string
      created_at: string
    }>(
      `SELECT u.username, d.wpm, d.accuracy, d.created_at
       FROM daily_results d JOIN users u ON u.id = d.user_id
       WHERE d.date = $1
       ORDER BY d.wpm DESC, d.created_at ASC
       LIMIT 100`,
      [date],
    )
    res.json({ date, entries: rows })
  }),
)

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

interface DailyBody {
  wpm: number
  accuracy: number
  rawWpm: number
}

function validate(body: unknown): DailyBody | string {
  const b = body as Partial<DailyBody>
  if (typeof b.wpm !== 'number' || b.wpm < 0 || b.wpm > 400) return 'Invalid wpm'
  if (typeof b.rawWpm !== 'number' || b.rawWpm < 0 || b.rawWpm > 500) return 'Invalid rawWpm'
  if (b.wpm > b.rawWpm + 0.01) return 'wpm cannot exceed rawWpm'
  if (typeof b.accuracy !== 'number' || b.accuracy < 0 || b.accuracy > 100) return 'Invalid accuracy'
  return b as DailyBody
}

// Submit today's daily result (auth). Keeps the user's best WPM for the day.
dailyRouter.post(
  '/daily/result',
  requireSignedIn,
  writeLimiter,
  wrap(async (req, res) => {
    const parsed = validate(req.body)
    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed })
      return
    }
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const date = todayUtc()

    // One attempt per day: the first submission counts; a repeat is rejected.
    const inserted = await pool.query(
      `INSERT INTO daily_results (user_id, date, wpm, accuracy, raw_wpm)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, date) DO NOTHING
       RETURNING id`,
      [user.id, date, parsed.wpm, parsed.accuracy, parsed.rawWpm],
    )
    if (inserted.rowCount === 0) {
      res.status(409).json({ error: "You've already taken today's challenge." })
      return
    }
    res.status(201).json({ date })
  }),
)
