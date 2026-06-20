import { getAuth } from '@clerk/express'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { requireSignedIn, upsertUser } from './auth.js'
import { pool } from './db.js'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

/** Validate an IANA time zone, falling back to UTC. Never interpolate raw. */
function safeTz(input: unknown): string {
  if (typeof input === 'string') {
    try {
      // Throws RangeError for an unknown zone.
      new Intl.DateTimeFormat('en-US', { timeZone: input })
      return input
    } catch {
      return 'UTC'
    }
  }
  return 'UTC'
}

// Both endpoints normalize the two activity streams — timed practice tests
// (results) and trainer lessons (training_sessions) — into one shape so they can
// be aggregated together. A lesson's time is the wall-clock span, capped at 1h so
// an idle-open trainer can't inflate the total.
const OVERVIEW_SQL = `
WITH activity AS (
  SELECT r.created_at AS ts, r.wpm AS wpm, r.accuracy AS accuracy,
         s.duration::numeric AS time_seconds
  FROM results r
  JOIN test_sessions s ON s.id = r.session_id
  WHERE r.user_id = $1
  UNION ALL
  SELECT t.started_at AS ts, t.peak_wpm AS wpm, t.avg_accuracy AS accuracy,
         LEAST(GREATEST(EXTRACT(EPOCH FROM (t.ended_at - t.started_at)), 0), 3600)::numeric
           AS time_seconds
  FROM training_sessions t
  WHERE t.user_id = $1
),
flagged AS (
  SELECT *, (ts AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date AS is_today
  FROM activity
)
SELECT
  COUNT(*)::int AS all_lessons,
  COALESCE(SUM(time_seconds), 0)::float8 AS all_time,
  MAX(wpm)::float8 AS all_top_wpm,
  AVG(wpm)::float8 AS all_avg_wpm,
  MAX(accuracy)::float8 AS all_top_acc,
  AVG(accuracy)::float8 AS all_avg_acc,
  (COUNT(*) FILTER (WHERE is_today))::int AS today_lessons,
  COALESCE((SUM(time_seconds) FILTER (WHERE is_today)), 0)::float8 AS today_time,
  (MAX(wpm) FILTER (WHERE is_today))::float8 AS today_top_wpm,
  (AVG(wpm) FILTER (WHERE is_today))::float8 AS today_avg_wpm,
  (MAX(accuracy) FILTER (WHERE is_today))::float8 AS today_top_acc,
  (AVG(accuracy) FILTER (WHERE is_today))::float8 AS today_avg_acc
FROM flagged
`

// Distinct calendar years with activity, plus the current year so the year tab
// for "this year" always exists even before any activity is recorded.
const YEARS_SQL = `
WITH activity AS (
  SELECT r.created_at AS ts FROM results r WHERE r.user_id = $1
  UNION ALL
  SELECT t.started_at AS ts FROM training_sessions t WHERE t.user_id = $1
)
SELECT DISTINCT year FROM (
  SELECT EXTRACT(YEAR FROM (ts AT TIME ZONE $2))::int AS year FROM activity
  UNION
  SELECT EXTRACT(YEAR FROM (now() AT TIME ZONE $2))::int
) y
ORDER BY year DESC
`

interface OverviewRow {
  all_lessons: number
  all_time: number
  all_top_wpm: number | null
  all_avg_wpm: number | null
  all_top_acc: number | null
  all_avg_acc: number | null
  today_lessons: number
  today_time: number
  today_top_wpm: number | null
  today_avg_wpm: number | null
  today_top_acc: number | null
  today_avg_acc: number | null
}

export const statsRouter = Router()
statsRouter.use(requireSignedIn)

statsRouter.get(
  '/stats/overview',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const tz = safeTz(req.query.tz)

    const [overview, years] = await Promise.all([
      pool.query<OverviewRow>(OVERVIEW_SQL, [user.id, tz]),
      pool.query<{ year: number }>(YEARS_SQL, [user.id, tz]),
    ])
    const row = overview.rows[0]!

    res.json({
      allTime: {
        timeSeconds: row.all_time,
        lessons: row.all_lessons,
        topWpm: row.all_top_wpm,
        avgWpm: row.all_avg_wpm,
        topAccuracy: row.all_top_acc,
        avgAccuracy: row.all_avg_acc,
      },
      today: {
        timeSeconds: row.today_time,
        lessons: row.today_lessons,
        topWpm: row.today_top_wpm,
        avgWpm: row.today_avg_wpm,
        topAccuracy: row.today_top_acc,
        avgAccuracy: row.today_avg_acc,
      },
      years: years.rows.map((r) => r.year),
    })
  }),
)

/** Step back one calendar day from a 'YYYY-MM-DD' string (UTC-safe). */
function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Current (up to today) + longest run of consecutive active days, with streak
 * freezes (§11). Already-frozen days count as active. When the current run hits
 * an *isolated* missing day (the day before it is active) and a freeze token is
 * available, the gap is bridged and the day is returned in `newlyFrozen` so the
 * caller can persist the consumption. Two adjacent missing days are never
 * bridged. With no freezes + no frozen days this matches plain streak counting.
 */
function computeStreaksWithFreezes(
  days: string[],
  today: string,
  frozenDays: string[],
  availableFreezes: number,
): { current: number; longest: number; newlyFrozen: string[] } {
  const set = new Set([...days, ...frozenDays])

  // Today not practiced yet shouldn't break a streak — start from yesterday then.
  let cursor = set.has(today) ? today : dayBefore(today)
  let current = 0
  let remaining = availableFreezes
  const newlyFrozen: string[] = []
  for (;;) {
    if (set.has(cursor)) {
      current += 1
      cursor = dayBefore(cursor)
      continue
    }
    // Isolated gap: bridge it with a freeze only if there's a prior active day.
    if (remaining > 0 && set.has(dayBefore(cursor))) {
      newlyFrozen.push(cursor)
      set.add(cursor)
      remaining -= 1
      current += 1
      cursor = dayBefore(cursor)
      continue
    }
    break
  }

  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const d of [...set].sort()) {
    run = prev && dayBefore(d) === prev ? run + 1 : 1
    if (run > longest) longest = run
    prev = d
  }

  return { current, longest, newlyFrozen }
}

statsRouter.get(
  '/stats/streak',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const tz = safeTz(req.query.tz)

    const [daysResult, todayResult, progResult] = await Promise.all([
      pool.query<{ day: string }>(
        `WITH activity AS (
           SELECT r.created_at AS ts FROM results r WHERE r.user_id = $1
           UNION ALL
           SELECT t.started_at AS ts FROM training_sessions t WHERE t.user_id = $1
         )
         SELECT DISTINCT to_char((ts AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day
         FROM activity
         ORDER BY day`,
        [user.id, tz],
      ),
      pool.query<{ today: string; today_secs: number }>(
        `WITH activity AS (
           SELECT r.created_at AS ts, s.duration::numeric AS secs
           FROM results r JOIN test_sessions s ON s.id = r.session_id
           WHERE r.user_id = $1
           UNION ALL
           SELECT t.started_at AS ts,
                  LEAST(GREATEST(EXTRACT(EPOCH FROM (t.ended_at - t.started_at)), 0), 3600)::numeric
           FROM training_sessions t WHERE t.user_id = $1
         )
         SELECT to_char((now() AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS today,
                COALESCE(
                  SUM(secs) FILTER (
                    WHERE (ts AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
                  ), 0
                )::float8 AS today_secs
         FROM activity`,
        [user.id, tz],
      ),
      pool.query<{ streak_freezes: number; frozen_days: string[] }>(
        `SELECT streak_freezes, frozen_days FROM user_progression WHERE user_id = $1`,
        [user.id],
      ),
    ])

    const today = todayResult.rows[0]!.today
    const availableFreezes = progResult.rows[0]?.streak_freezes ?? 0
    const frozenDays = Array.isArray(progResult.rows[0]?.frozen_days)
      ? progResult.rows[0]!.frozen_days
      : []
    const { current, longest, newlyFrozen } = computeStreaksWithFreezes(
      daysResult.rows.map((r) => r.day),
      today,
      frozenDays,
      availableFreezes,
    )

    // Persist any freeze tokens consumed to bridge gaps (idempotent: newlyFrozen
    // days were missing, so they can't already be in frozen_days).
    if (newlyFrozen.length > 0) {
      await pool.query(
        `UPDATE user_progression
            SET streak_freezes = streak_freezes - $2,
                frozen_days = frozen_days || $3::jsonb,
                updated_at = now()
          WHERE user_id = $1`,
        [user.id, newlyFrozen.length, JSON.stringify(newlyFrozen)],
      )
    }

    res.json({
      current,
      longest,
      todaySeconds: todayResult.rows[0]!.today_secs,
      streakFreezes: availableFreezes - newlyFrozen.length,
    })
  }),
)

statsRouter.get(
  '/stats/wpm-series',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const tz = safeTz(req.query.tz)

    const daysRaw = Number(req.query.days)
    const days = [30, 90, 365].includes(daysRaw) ? daysRaw : 90

    // Avg + best WPM per tz-local day from timed tests over the trailing window.
    const { rows } = await pool.query<{ day: string; avg_wpm: number; best_wpm: number }>(
      `SELECT to_char((created_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day,
              AVG(wpm)::float8 AS avg_wpm,
              MAX(wpm)::float8 AS best_wpm
       FROM results
       WHERE user_id = $1 AND created_at >= now() - make_interval(days => $3::int)
       GROUP BY (created_at AT TIME ZONE $2)::date
       ORDER BY (created_at AT TIME ZONE $2)::date`,
      [user.id, tz, days],
    )

    res.json({
      series: rows.map((r) => ({
        day: r.day,
        avgWpm: Math.round(r.avg_wpm),
        bestWpm: Math.round(r.best_wpm),
      })),
    })
  }),
)

// WPM by time of day (§26): average WPM + test count per tz-local hour.
statsRouter.get(
  '/stats/by-hour',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const tz = safeTz(req.query.tz)
    const { rows } = await pool.query<{ hour: number; avg_wpm: number; tests: number }>(
      `SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE $2))::int AS hour,
              AVG(wpm)::float8 AS avg_wpm,
              COUNT(*)::int AS tests
       FROM results WHERE user_id = $1
       GROUP BY hour ORDER BY hour`,
      [user.id, tz],
    )
    res.json({
      byHour: rows.map((r) => ({ hour: r.hour, avgWpm: Math.round(r.avg_wpm), tests: r.tests })),
    })
  }),
)

// Consistency score (§26): how steady recent WPM is. 100 = identical every test,
// lower = more variance. Derived from the coefficient of variation over the last
// 50 timed tests.
statsRouter.get(
  '/stats/consistency',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const { rows } = await pool.query<{ n: number; mean: number | null; sd: number | null }>(
      `SELECT COUNT(*)::int AS n, AVG(wpm)::float8 AS mean, STDDEV_POP(wpm)::float8 AS sd
       FROM (SELECT wpm FROM results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50) z`,
      [user.id],
    )
    const r = rows[0]!
    const score =
      r.mean && r.mean > 0 && r.sd != null
        ? Math.max(0, Math.min(100, Math.round(100 * (1 - r.sd / r.mean))))
        : null
    res.json({ score, sampleSize: r.n, avgWpm: r.mean != null ? Math.round(r.mean) : null })
  }),
)

statsRouter.get(
  '/stats/activity',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const tz = safeTz(req.query.tz)

    const yearRaw = req.query.year
    const year =
      typeof yearRaw === 'string' && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null

    // Calendar-year tab → that year; default → rolling last 12 months.
    const range = year
      ? `EXTRACT(YEAR FROM (ts AT TIME ZONE $2)) = $3::int`
      : `ts >= now() - interval '1 year'`
    const params: (string | number)[] = year ? [user.id, tz, year] : [user.id, tz]

    const sql = `
      WITH activity AS (
        SELECT r.created_at AS ts, 'test'::text AS kind
        FROM results r WHERE r.user_id = $1
        UNION ALL
        SELECT t.started_at AS ts, 'lesson'::text AS kind
        FROM training_sessions t WHERE t.user_id = $1
      )
      SELECT to_char((ts AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS date,
             (COUNT(*) FILTER (WHERE kind = 'test'))::int AS tests,
             (COUNT(*) FILTER (WHERE kind = 'lesson'))::int AS lessons,
             COUNT(*)::int AS count
      FROM activity
      WHERE ${range}
      GROUP BY (ts AT TIME ZONE $2)::date
      ORDER BY (ts AT TIME ZONE $2)::date
    `
    const { rows } = await pool.query<{
      date: string
      tests: number
      lessons: number
      count: number
    }>(sql, params)

    res.json({ days: rows })
  }),
)
