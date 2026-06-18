import { clerkClient, getAuth } from '@clerk/express'
import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { pool } from './db.js'

export interface AppUser {
  id: string
  clerk_id: string
  email: string | null
  username: string | null
  username_changed_at: string | null
}

// Usernames can be renamed at most once per 7 days (enforced server-side here,
// since Clerk has no built-in rate limit). The initial set is exempt.
const RENAME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// Express 4 doesn't catch async errors; wrap handlers that hit the DB.
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

/** Find-or-create our users row for a Clerk identity (Clerk owns credentials). */
export async function upsertUser(clerkId: string): Promise<AppUser> {
  const clerkUser = await clerkClient.users.getUser(clerkId)
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? null
  // Clerk owns the username (required at sign-up) and enforces uniqueness; this
  // is just a cached copy. Older accounts predate that, so keep a derive fallback.
  const username =
    clerkUser.username ?? clerkUser.firstName ?? email?.split('@')[0] ?? null

  try {
    return await runUserUpsert(clerkId, email, username)
  } catch (err) {
    // A duplicate username (legacy rows / a derived-name collision) must not 500.
    // Keep the row; just don't claim the taken name — the user can set one in
    // Settings. Clerk enforces real uniqueness, so this is only a backstop.
    if (isUsernameConflict(err)) {
      return await runUserUpsert(clerkId, email, null)
    }
    // The email is already held by a row with a different clerk_id — typically
    // the same person returning under a new Clerk identity (a test→live instance
    // switch issues a fresh clerk_id while their email is unchanged). ON CONFLICT
    // (clerk_id) can't catch this, so re-link that row to the current identity
    // rather than 500ing — the user keeps their history (results, PBs).
    if (isEmailConflict(err) && email) {
      return await relinkByEmail(clerkId, email, username)
    }
    throw err
  }
}

/** Re-point an existing users row (matched by its unique email) at a new Clerk
 *  identity. The original INSERT failed on the email constraint, not clerk_id,
 *  so no row holds this clerk_id yet — the reassignment is safe. */
async function relinkByEmail(
  clerkId: string,
  email: string,
  username: string | null,
): Promise<AppUser> {
  try {
    return await runRelink(clerkId, email, username)
  } catch (err) {
    // The derived username may collide with another row; keep the existing one.
    if (isUsernameConflict(err)) {
      return await runRelink(clerkId, email, null)
    }
    throw err
  }
}

/** COALESCE keeps the row's existing username when Clerk's derived one is null
 *  or would collide, so re-linking never erases a name the user already has. */
async function runRelink(
  clerkId: string,
  email: string,
  username: string | null,
): Promise<AppUser> {
  const { rows } = await pool.query<AppUser>(
    `UPDATE users
        SET clerk_id = $1,
            username = COALESCE($3, username)
      WHERE email = $2
    RETURNING id, clerk_id, email, username, username_changed_at`,
    [clerkId, email, username],
  )
  const user = rows[0]
  if (!user) throw new Error('user relink matched no row')
  return user
}

/** The upsert itself. COALESCE keeps an existing cached username if Clerk's is
 *  null, so a sync never erases a name the user already has. */
async function runUserUpsert(
  clerkId: string,
  email: string | null,
  username: string | null,
): Promise<AppUser> {
  const { rows } = await pool.query<AppUser>(
    `INSERT INTO users (clerk_id, email, username)
     VALUES ($1, $2, $3)
     ON CONFLICT (clerk_id)
     DO UPDATE SET email = EXCLUDED.email,
                   username = COALESCE(EXCLUDED.username, users.username)
     RETURNING id, clerk_id, email, username, username_changed_at`,
    [clerkId, email, username],
  )
  const user = rows[0]
  if (!user) throw new Error('user upsert returned no row')
  return user
}

/** True for a Postgres unique-violation (23505) on the username constraint. */
function isUsernameConflict(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: string; constraint?: string }
  return e.code === '23505' && typeof e.constraint === 'string' && e.constraint.includes('username')
}

/** True for a Postgres unique-violation (23505) on the email constraint. */
function isEmailConflict(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: string; constraint?: string }
  return e.code === '23505' && typeof e.constraint === 'string' && e.constraint.includes('email')
}

/** JSON-API auth guard: 401 instead of Clerk's default redirect. */
export function requireSignedIn(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req)
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  next()
}

export const authRouter = Router()

// Renames are already capped to once/week in the handler; this throttles abuse
// of the endpoint itself (e.g. brute-forcing availability of taken names).
const usernameLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

// Protected route confirming the Clerk token flow end to end.
authRouter.get(
  '/me',
  requireSignedIn,
  wrap(async (req, res) => {
    const { userId } = getAuth(req)
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    const user = await upsertUser(userId)
    res.json({ user })
  }),
)

// Change (or initially set) the username. Clerk owns the username and enforces
// format + uniqueness; we gate it here so a rename happens at most once per week.
// The first set (no existing Clerk username — the mandatory-creation path) is
// exempt and does not start the weekly clock.
authRouter.put(
  '/username',
  usernameLimiter,
  requireSignedIn,
  wrap(async (req, res) => {
    const raw = (req.body as { username?: unknown })?.username
    if (typeof raw !== 'string') {
      res.status(400).json({ error: 'Username is required' })
      return
    }
    const username = raw.trim()
    if (username.length === 0 || username.length > 64) {
      res.status(400).json({ error: 'Username must be 1–64 characters' })
      return
    }

    const { userId } = getAuth(req)
    // Ensure our row exists / is current, then read the last-change time.
    const user = await upsertUser(userId!)
    const clerkUser = await clerkClient.users.getUser(userId!)
    const isInitialSet = !clerkUser.username

    // A rename within the window is rejected; the initial set is never gated.
    if (!isInitialSet && user.username_changed_at) {
      const nextAllowed = new Date(user.username_changed_at).getTime() + RENAME_WINDOW_MS
      if (Date.now() < nextAllowed) {
        res.status(429).json({
          error: 'You can only change your username once per week.',
          nextChangeAllowedAt: new Date(nextAllowed).toISOString(),
        })
        return
      }
    }

    // Renaming to the same name is a no-op — don't burn the weekly window on it.
    if (clerkUser.username === username) {
      res.json({ username, nextChangeAllowedAt: nextChangeAllowedAt(user.username_changed_at) })
      return
    }

    try {
      await clerkClient.users.updateUser(userId!, { username })
    } catch (err) {
      const { status, message } = classifyClerkUsernameError(err)
      res.status(status).json({ error: message })
      return
    }

    // Start the weekly clock on a real rename; leave it null for an initial set.
    const changedAt = isInitialSet ? null : new Date().toISOString()
    await pool.query(`UPDATE users SET username = $1, username_changed_at = $2 WHERE id = $3`, [
      username,
      changedAt,
      user.id,
    ])

    res.json({ username, nextChangeAllowedAt: nextChangeAllowedAt(changedAt) })
  }),
)

/** When the next rename becomes allowed, given the last-change timestamp. */
function nextChangeAllowedAt(changedAt: string | null): string | null {
  if (!changedAt) return null
  return new Date(new Date(changedAt).getTime() + RENAME_WINDOW_MS).toISOString()
}

/** Maps a Clerk updateUser error to an HTTP status + message. A taken name
 *  surfaces an "identifier_exists" code; anything else is a format rejection,
 *  where Clerk's own message states the real rule. */
function classifyClerkUsernameError(err: unknown): { status: number; message: string } {
  const errors =
    typeof err === 'object' && err !== null && 'errors' in err
      ? (err as { errors?: Array<{ code?: string; message?: string; longMessage?: string }> }).errors
      : undefined
  const first = errors?.[0]
  if (!first) {
    // Not a Clerk validation error (auth/permission/network) — surface as a
    // server-side failure, not a misleading "invalid username", and log the
    // real cause for diagnosis.
    console.error('username update failed (non-validation error):', err)
    return { status: 500, message: 'Couldn’t update your username right now — please try again.' }
  }
  if ((first.code ?? '').includes('identifier_exists')) {
    return { status: 409, message: 'That username is taken.' }
  }
  // Clerk's own message states the exact rule it rejected (length, characters…).
  return { status: 400, message: first.longMessage ?? first.message ?? 'That username isn’t allowed.' }
}

// UI preferences sync. localStorage is the client's source of truth; this
// mirrors it so the same account looks the same on every device. The blob is
// stored opaquely — the frontend validates/normalizes shape on read.
authRouter.get(
  '/preferences',
  requireSignedIn,
  wrap(async (req, res) => {
    const { userId } = getAuth(req)
    const user = await upsertUser(userId!)
    const { rows } = await pool.query<{ preferences: unknown | null }>(
      `SELECT preferences FROM users WHERE id = $1`,
      [user.id],
    )
    res.json({ preferences: rows[0]?.preferences ?? null })
  }),
)

authRouter.put(
  '/preferences',
  requireSignedIn,
  wrap(async (req, res) => {
    const preferences = (req.body as { preferences?: unknown })?.preferences
    if (typeof preferences !== 'object' || preferences === null || Array.isArray(preferences)) {
      res.status(400).json({ error: 'Invalid preferences' })
      return
    }
    const { userId } = getAuth(req)
    const user = await upsertUser(userId!)
    await pool.query(`UPDATE users SET preferences = $1 WHERE id = $2`, [preferences, user.id])
    res.json({ preferences })
  }),
)
