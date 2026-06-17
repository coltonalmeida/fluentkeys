import { getAuth } from '@clerk/express'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { evaluateAchievements } from './achievements.js'
import { requireSignedIn, upsertUser } from './auth.js'
import { pool } from './db.js'

// Mirrors the frontend's unlock model (home row → frequency). The starter index
// is the home row (9 letters); the full progression is 26 letters.
const STARTER_INDEX = 9
const MAX_INDEX = 26
const ROLLING_WINDOW = 50
const LETTER_RE = /^[a-z]$/

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

interface Sample {
  key: string
  correct: boolean
  reactionMs: number
  timestamp: number
}
interface LetterPayload {
  letter: string
  strength: number
  samples: Sample[]
}
interface SessionBody {
  unlockedCount: number
  letters: LetterPayload[]
  session: {
    wordsTyped: number
    peakWpm: number
    avgAccuracy: number
    newUnlocks: string[]
    startedAt: number | null
  }
}

function clampInt(value: unknown, lo: number, hi: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(hi, Math.max(lo, Math.floor(value)))
    : lo
}

function sanitizeSamples(input: unknown): Sample[] {
  if (!Array.isArray(input)) return []
  const clean: Sample[] = []
  for (const raw of input) {
    const s = raw as Partial<Sample>
    if (typeof s.key !== 'string' || s.key.length !== 1) continue
    if (typeof s.correct !== 'boolean') continue
    if (typeof s.reactionMs !== 'number' || !Number.isFinite(s.reactionMs)) continue
    if (typeof s.timestamp !== 'number' || !Number.isFinite(s.timestamp)) continue
    clean.push({ key: s.key, correct: s.correct, reactionMs: s.reactionMs, timestamp: s.timestamp })
  }
  return clean.slice(-ROLLING_WINDOW) // never trust more than the window size
}

/** Trust-but-validate, mirroring the results endpoint's stance (CLAUDE.md). */
function validateSession(body: unknown): SessionBody | string {
  const b = body as Partial<SessionBody>
  if (
    typeof b.unlockedCount !== 'number' ||
    b.unlockedCount < STARTER_INDEX ||
    b.unlockedCount > MAX_INDEX
  ) {
    return 'Invalid unlockedCount'
  }
  if (!Array.isArray(b.letters) || b.letters.length > 30) return 'Invalid letters'

  const letters: LetterPayload[] = []
  for (const raw of b.letters) {
    const l = raw as Partial<LetterPayload>
    if (typeof l.letter !== 'string' || !LETTER_RE.test(l.letter)) return 'Invalid letter'
    const strength =
      typeof l.strength === 'number' ? Math.min(100, Math.max(0, l.strength)) : 0
    letters.push({ letter: l.letter, strength, samples: sanitizeSamples(l.samples) })
  }

  const s = (b.session ?? {}) as Partial<SessionBody['session']>
  const session = {
    wordsTyped: clampInt(s.wordsTyped, 0, 1_000_000),
    peakWpm: clampInt(s.peakWpm, 0, 500),
    avgAccuracy: typeof s.avgAccuracy === 'number' ? Math.min(100, Math.max(0, s.avgAccuracy)) : 0,
    newUnlocks: Array.isArray(s.newUnlocks)
      ? s.newUnlocks.filter((x): x is string => typeof x === 'string' && LETTER_RE.test(x))
      : [],
    startedAt: typeof s.startedAt === 'number' && Number.isFinite(s.startedAt) ? s.startedAt : null,
  }

  return { unlockedCount: Math.floor(b.unlockedCount), letters, session }
}

export const trainingRouter = Router()
trainingRouter.use(requireSignedIn)

// Load the user's persisted trainer state (cross-device continuity).
// NOTE: strength decay (spec §2.3) is implemented client-side as DISPLAY-ONLY
// (see lib/letterStrength.ts `applyDecay`/`displayStrengthMap`). Idle letters fade
// in the shown score but never re-lock — the unlock gate keeps using the raw
// rolling-window strength. The server stores raw samples + last_practiced_at; the
// client derives decay from per-sample timestamps, so no server-side decay runs.
trainingRouter.get(
  '/training/state',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)

    const profile = await pool.query<{ unlocked_up_to_index: number }>(
      `SELECT unlocked_up_to_index FROM training_profiles WHERE user_id = $1`,
      [user.id],
    )
    const unlockedCount = profile.rows[0]?.unlocked_up_to_index ?? STARTER_INDEX

    const strengths = await pool.query<{ letter: string; recent_samples: Sample[] }>(
      `SELECT letter, recent_samples FROM letter_strengths WHERE user_id = $1`,
      [user.id],
    )
    const windows: Record<string, Sample[]> = {}
    for (const row of strengths.rows) {
      windows[row.letter.trim()] = Array.isArray(row.recent_samples) ? row.recent_samples : []
    }

    res.json({ unlockedCount, windows })
  }),
)

// Persist a finished session: bump the unlock index, upsert per-letter windows,
// and store a session summary row.
trainingRouter.post(
  '/training/session',
  wrap(async (req, res) => {
    const parsed = validateSession(req.body)
    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed })
      return
    }
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      await client.query(
        `INSERT INTO training_profiles (user_id, unlocked_up_to_index, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_id)
         DO UPDATE SET
           unlocked_up_to_index = GREATEST(
             training_profiles.unlocked_up_to_index, EXCLUDED.unlocked_up_to_index),
           updated_at = now()`,
        [user.id, parsed.unlockedCount],
      )

      for (const l of parsed.letters) {
        await client.query(
          `INSERT INTO letter_strengths
             (user_id, letter, strength_score, sample_count, last_practiced_at, recent_samples)
           VALUES ($1, $2, $3, $4, now(), $5)
           ON CONFLICT (user_id, letter)
           DO UPDATE SET
             strength_score = EXCLUDED.strength_score,
             sample_count = EXCLUDED.sample_count,
             last_practiced_at = now(),
             recent_samples = EXCLUDED.recent_samples`,
          [user.id, l.letter, l.strength, l.samples.length, JSON.stringify(l.samples)],
        )
      }

      await client.query(
        `INSERT INTO training_sessions
           (user_id, started_at, ended_at, words_typed, peak_wpm, avg_accuracy, unlock_events)
         VALUES ($1, COALESCE($2, now()), now(), $3, $4, $5, $6)`,
        [
          user.id,
          parsed.session.startedAt ? new Date(parsed.session.startedAt) : null,
          parsed.session.wordsTyped,
          parsed.session.peakWpm,
          parsed.session.avgAccuracy,
          JSON.stringify(parsed.session.newUnlocks),
        ],
      )

      const newlyEarned = await evaluateAchievements(client, user.id)
      await client.query('COMMIT')
      res.status(201).json({ ok: true, newlyEarned })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }),
)
