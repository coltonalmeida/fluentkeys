import { getAuth } from '@clerk/express'
import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { requireSignedIn, upsertUser } from './auth.js'
import { pool } from './db.js'

// Keystroke traces for replay + heatmaps (§27). A trace is the target text plus a
// bounded list of keystroke events; replay re-simulates it against the target.

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

export interface TraceEvent {
  /** ms since the first keystroke */
  t: number
  /** the typed character, or '\b' for backspace */
  ch: string
  /** whether it matched the expected character */
  ok: boolean
}

export interface Trace {
  target: string
  durationSeconds: number
  events: TraceEvent[]
}

const MAX_EVENTS = 6000
const MAX_TARGET = 6000

/** Trust-but-bound a client trace. Returns the sanitized trace or an error string. */
export function validateTrace(body: unknown): Trace | string {
  const b = body as Partial<Trace>
  if (typeof b.target !== 'string' || b.target.length === 0 || b.target.length > MAX_TARGET)
    return 'Invalid target'
  if (typeof b.durationSeconds !== 'number' || b.durationSeconds <= 0 || b.durationSeconds > 600)
    return 'Invalid durationSeconds'
  if (!Array.isArray(b.events)) return 'Invalid events'
  const events: TraceEvent[] = []
  for (const raw of b.events.slice(0, MAX_EVENTS)) {
    const e = raw as Partial<TraceEvent>
    if (typeof e.t !== 'number' || !Number.isFinite(e.t) || e.t < 0) continue
    if (typeof e.ch !== 'string' || e.ch.length > 12) continue
    if (typeof e.ok !== 'boolean') continue
    events.push({ t: Math.round(e.t), ch: e.ch, ok: e.ok })
  }
  return { target: b.target, durationSeconds: b.durationSeconds, events }
}

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
})

export const tracesRouter = Router()

// Store the trace for one of the caller's own results (§27).
tracesRouter.post(
  '/results/:id/trace',
  requireSignedIn,
  writeLimiter,
  wrap(async (req, res) => {
    const trace = validateTrace(req.body)
    if (typeof trace === 'string') {
      res.status(400).json({ error: trace })
      return
    }
    const resultId = String(req.params.id)
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)

    // Only the owner of the result may attach its trace.
    const owns = await pool.query(`SELECT 1 FROM results WHERE id = $1 AND user_id = $2`, [
      resultId,
      user.id,
    ])
    if (owns.rowCount === 0) {
      res.status(404).json({ error: 'Result not found' })
      return
    }

    await pool.query(
      `INSERT INTO keystroke_traces (result_id, user_id, trace)
       VALUES ($1, $2, $3)
       ON CONFLICT (result_id) DO UPDATE SET trace = EXCLUDED.trace`,
      [resultId, user.id, JSON.stringify(trace)],
    )
    res.status(201).json({ ok: true })
  }),
)

// Public read so shared results (§1) can show a replay too.
tracesRouter.get(
  '/results/:id/trace',
  wrap(async (req, res) => {
    const resultId = String(req.params.id)
    const { rows } = await pool.query<{ trace: Trace }>(
      `SELECT trace FROM keystroke_traces WHERE result_id = $1`,
      [resultId],
    )
    if (!rows[0]) {
      res.status(404).json({ error: 'No trace for this result' })
      return
    }
    res.json({ trace: rows[0].trace })
  }),
)
