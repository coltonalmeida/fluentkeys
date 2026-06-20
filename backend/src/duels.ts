import { getAuth } from '@clerk/express'
import crypto from 'crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { requireSignedIn, upsertUser } from './auth.js'
import { pool } from './db.js'
import { validateTrace } from './traces.js'

// Async "ghost" duels (§3): a finished test becomes a shareable challenge. The
// challenger types the stored target and races the creator's keystroke trace.

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

/** URL-safe random code (~8 chars). */
function newCode(): string {
  return crypto.randomBytes(6).toString('base64url')
}

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

export const duelsRouter = Router()

// Create a duel from a finished test (auth).
duelsRouter.post(
  '/duels',
  requireSignedIn,
  writeLimiter,
  wrap(async (req, res) => {
    const trace = validateTrace(req.body)
    if (typeof trace === 'string') {
      res.status(400).json({ error: trace })
      return
    }
    const b = req.body as { wpm?: unknown; accuracy?: unknown }
    if (typeof b.wpm !== 'number' || b.wpm < 0 || b.wpm > 400) {
      res.status(400).json({ error: 'Invalid wpm' })
      return
    }
    if (typeof b.accuracy !== 'number' || b.accuracy < 0 || b.accuracy > 100) {
      res.status(400).json({ error: 'Invalid accuracy' })
      return
    }

    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)

    // Retry a couple of times on the (astronomically rare) code collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newCode()
      try {
        await pool.query(
          `INSERT INTO duels (code, creator_user_id, target, duration, creator_wpm, creator_accuracy, creator_trace)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            code,
            user.id,
            trace.target,
            Math.round(trace.durationSeconds),
            b.wpm,
            b.accuracy,
            JSON.stringify(trace.events),
          ],
        )
        res.status(201).json({ code })
        return
      } catch (err) {
        const e = err as { code?: string }
        if (e.code === '23505') continue // duplicate code — try again
        throw err
      }
    }
    res.status(500).json({ error: 'Could not create duel' })
  }),
)

// Load a duel (public): seed the same words + the creator's ghost.
duelsRouter.get(
  '/duels/:code',
  wrap(async (req, res) => {
    const code = String(req.params.code)
    const { rows } = await pool.query<{
      target: string
      duration: number
      creator_wpm: string
      creator_accuracy: string
      creator_trace: unknown
      username: string | null
    }>(
      `SELECT d.target, d.duration, d.creator_wpm, d.creator_accuracy, d.creator_trace,
              u.username
       FROM duels d JOIN users u ON u.id = d.creator_user_id
       WHERE d.code = $1`,
      [code],
    )
    const duel = rows[0]
    if (!duel) {
      res.status(404).json({ error: 'Duel not found' })
      return
    }
    res.json({
      code,
      target: duel.target,
      duration: duel.duration,
      creatorUsername: duel.username,
      creatorWpm: Number(duel.creator_wpm),
      creatorAccuracy: Number(duel.creator_accuracy),
      events: duel.creator_trace,
    })
  }),
)
