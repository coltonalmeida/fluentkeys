import { Router, type NextFunction, type Request, type Response } from 'express'
import { pool } from './db.js'
import {
  digestEmail,
  emailEnabled,
  rivalEmail,
  sendEmail,
  streakEmail,
  verifyUnsubscribeToken,
} from './email.js'

// Scheduled re-engagement jobs (§10). Triggered by an external scheduler (Render
// Cron / GitHub Action) hitting POST /jobs/run, or via `npm run job:<type>`. The
// whole system is inert until RESEND_API_KEY is set (sends become logs).

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

export type JobType = 'digest' | 'streak' | 'rivals'

interface JobResult {
  type: JobType
  candidates: number
  sent: number
}

/** Weekly progress digest to anyone active in the last 7 days. */
export async function runDigest(): Promise<JobResult> {
  const { rows } = await pool.query<{
    id: string
    email: string
    top_wpm: number
    tests: number
    active_days: number
  }>(
    `SELECT u.id, u.email,
            COALESCE(MAX(r.wpm), 0)::float8 AS top_wpm,
            COUNT(r.*)::int AS tests,
            COUNT(DISTINCT (r.created_at)::date)::int AS active_days
     FROM users u
     JOIN results r ON r.user_id = u.id AND r.created_at > now() - interval '7 days'
     WHERE u.email IS NOT NULL AND u.email_opt_out = false
     GROUP BY u.id, u.email`,
  )
  let sent = 0
  for (const u of rows) {
    const { subject, html } = digestEmail(u.id, {
      topWpm: u.top_wpm,
      tests: u.tests,
      activeDays: u.active_days,
    })
    if (await sendEmail(u.email, subject, html)) sent += 1
  }
  return { type: 'digest', candidates: rows.length, sent }
}

/** "Your streak is about to break" — active yesterday (UTC) but not today. */
export async function runStreakReminders(): Promise<JobResult> {
  const { rows } = await pool.query<{ id: string; email: string }>(
    `WITH days AS (
       SELECT u.id, u.email, (a.ts)::date AS d
       FROM users u
       JOIN (
         SELECT user_id, created_at AS ts FROM results
         UNION ALL
         SELECT user_id, started_at FROM training_sessions
       ) a ON a.user_id = u.id
       WHERE u.email IS NOT NULL AND u.email_opt_out = false
     )
     SELECT DISTINCT id, email FROM days d
     WHERE d.d = (now() AT TIME ZONE 'UTC')::date - 1
       AND NOT EXISTS (
         SELECT 1 FROM days d2 WHERE d2.id = d.id AND d2.d = (now() AT TIME ZONE 'UTC')::date
       )`,
  )

  let sent = 0
  for (const u of rows) {
    const streak = await trailingStreak(u.id)
    if (streak < 2) continue // only nudge a streak worth saving
    const { subject, html } = streakEmail(u.id, { streak })
    if (await sendEmail(u.email, subject, html)) sent += 1
  }
  return { type: 'streak', candidates: rows.length, sent }
}

/** Consecutive active days ending *yesterday* (UTC) for one user. */
async function trailingStreak(userId: string): Promise<number> {
  const { rows } = await pool.query<{ d: string }>(
    `SELECT DISTINCT (a.ts)::date AS d FROM (
       SELECT created_at AS ts FROM results WHERE user_id = $1
       UNION ALL SELECT started_at FROM training_sessions WHERE user_id = $1
     ) a
     WHERE a.ts > now() - interval '90 days'
     ORDER BY d DESC`,
    [userId],
  )
  const set = new Set(rows.map((r) => r.d))
  let cursor = new Date(Date.now())
  cursor.setUTCDate(cursor.getUTCDate() - 1) // start from yesterday
  let streak = 0
  for (;;) {
    const key = cursor.toISOString().slice(0, 10)
    if (!set.has(key)) break
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

/** "A rival beat your PB" — a followee posted a top score in the last 24h that
 *  exceeds the user's best. */
export async function runRivalAlerts(): Promise<JobResult> {
  const { rows } = await pool.query<{ id: string; email: string; rival: string | null; wpm: number }>(
    `SELECT DISTINCT ON (u.id) u.id, u.email, ru.username AS rival, le.wpm::float8 AS wpm
     FROM users u
     JOIN follows f ON f.follower_id = u.id
     JOIN leaderboard_entries le ON le.user_id = f.followee_id
          AND le.created_at > now() - interval '1 day'
     JOIN users ru ON ru.id = f.followee_id
     WHERE u.email IS NOT NULL AND u.email_opt_out = false
       AND le.wpm > COALESCE((SELECT MAX(wpm) FROM personal_bests WHERE user_id = u.id), 0)
     ORDER BY u.id, le.wpm DESC`,
  )
  let sent = 0
  for (const u of rows) {
    const { subject, html } = rivalEmail(u.id, { rival: u.rival ?? 'A rival', wpm: u.wpm })
    if (await sendEmail(u.email, subject, html)) sent += 1
  }
  return { type: 'rivals', candidates: rows.length, sent }
}

export async function runJob(type: JobType): Promise<JobResult> {
  if (type === 'digest') return runDigest()
  if (type === 'streak') return runStreakReminders()
  return runRivalAlerts()
}

export const jobsRouter = Router()

// Trigger a job. Guarded by the CRON_SECRET header; disabled (503) if unset.
jobsRouter.post(
  '/jobs/run',
  wrap(async (req, res) => {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      res.status(503).json({ error: 'Jobs are disabled (CRON_SECRET not set)' })
      return
    }
    if (req.get('x-cron-secret') !== secret) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    const type = String(req.query.type ?? '')
    if (type !== 'digest' && type !== 'streak' && type !== 'rivals') {
      res.status(400).json({ error: 'Invalid type (digest|streak|rivals)' })
      return
    }
    const result = await runJob(type)
    res.json({ ...result, emailEnabled: emailEnabled() })
  }),
)

// Tokenized one-click unsubscribe link target (in every email footer).
jobsRouter.get(
  '/email/unsubscribe',
  wrap(async (req, res) => {
    const token = String(req.query.token ?? '')
    const userId = verifyUnsubscribeToken(token)
    if (!userId) {
      res.status(400).type('html').send('<!doctype html><p>Invalid unsubscribe link.</p>')
      return
    }
    await pool.query(`UPDATE users SET email_opt_out = true WHERE id = $1`, [userId])
    res
      .type('html')
      .send('<!doctype html><p>You have been unsubscribed from FluentKeys emails.</p>')
  }),
)
