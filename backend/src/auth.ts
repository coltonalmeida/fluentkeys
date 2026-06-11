import { clerkClient, getAuth } from '@clerk/express'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { pool } from './db.js'

export interface AppUser {
  id: string
  clerk_id: string
  email: string | null
  username: string | null
}

// Express 4 doesn't catch async errors; wrap handlers that hit the DB.
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

/** Find-or-create our users row for a Clerk identity (Clerk owns credentials). */
export async function upsertUser(clerkId: string): Promise<AppUser> {
  const clerkUser = await clerkClient.users.getUser(clerkId)
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? null
  const username =
    clerkUser.username ?? clerkUser.firstName ?? email?.split('@')[0] ?? null

  const { rows } = await pool.query<AppUser>(
    `INSERT INTO users (clerk_id, email, username)
     VALUES ($1, $2, $3)
     ON CONFLICT (clerk_id)
     DO UPDATE SET email = EXCLUDED.email, username = EXCLUDED.username
     RETURNING id, clerk_id, email, username`,
    [clerkId, email, username],
  )
  const user = rows[0]
  if (!user) throw new Error('user upsert returned no row')
  return user
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
