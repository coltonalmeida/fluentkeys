import { getAuth } from '@clerk/express'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { requireSignedIn, upsertUser } from './auth.js'
import { pool } from './db.js'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

export const followsRouter = Router()
followsRouter.use(requireSignedIn)

// Search users by username (excluding self) to find rivals to follow.
followsRouter.get(
  '/users/search',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const me = await upsertUser(clerkId!)
    const q = String(req.query.q ?? '').trim()
    if (q.length < 1) {
      res.json({ users: [] })
      return
    }
    const { rows } = await pool.query<{ id: string; username: string | null }>(
      `SELECT id, username FROM users
       WHERE id <> $1 AND username IS NOT NULL AND username ILIKE $2
       ORDER BY username
       LIMIT 10`,
      [me.id, `%${q}%`],
    )
    res.json({ users: rows })
  }),
)

// Who the signed-in user follows.
followsRouter.get(
  '/follows',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const me = await upsertUser(clerkId!)
    const { rows } = await pool.query<{ id: string; username: string | null }>(
      `SELECT u.id, u.username
       FROM follows f JOIN users u ON u.id = f.followee_id
       WHERE f.follower_id = $1
       ORDER BY u.username`,
      [me.id],
    )
    res.json({ follows: rows })
  }),
)

followsRouter.post(
  '/follows',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const me = await upsertUser(clerkId!)
    const followeeId = String((req.body as { followeeId?: unknown }).followeeId ?? '')
    if (!/^\d+$/.test(followeeId) || followeeId === me.id) {
      res.status(400).json({ error: 'Invalid followeeId' })
      return
    }
    const exists = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [followeeId])
    if (exists.rowCount === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    await pool.query(
      `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [me.id, followeeId],
    )
    res.status(201).json({ ok: true })
  }),
)

followsRouter.delete(
  '/follows',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const me = await upsertUser(clerkId!)
    const followeeId = String((req.body as { followeeId?: unknown }).followeeId ?? '')
    if (!/^\d+$/.test(followeeId)) {
      res.status(400).json({ error: 'Invalid followeeId' })
      return
    }
    await pool.query(`DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [
      me.id,
      followeeId,
    ])
    res.json({ ok: true })
  }),
)
