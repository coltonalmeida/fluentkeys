import { getAuth } from '@clerk/express'
import crypto from 'crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { requireSignedIn, upsertUser } from './auth.js'
import { pool } from './db.js'
import { awardXp, grantCosmetic, syncRewards } from './progression.js'

// Referral / invite loop (§4). Each user gets one code; a new user redeems one
// code on sign-up, linking them to the referrer and rewarding both with XP + the
// 'badge-referrer' cosmetic.

const REFERRAL_XP = 100
const REFERRER_BADGE = 'badge-referrer'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

/** Short, URL-safe, human-friendlyish referral code. */
function newCode(): string {
  return crypto.randomBytes(5).toString('base64url')
}

/** Get the user's code, creating one on first request. */
async function ensureCode(userId: string): Promise<string> {
  const existing = await pool.query<{ code: string }>(
    `SELECT code FROM referrals WHERE user_id = $1`,
    [userId],
  )
  if (existing.rows[0]) return existing.rows[0].code
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode()
    try {
      await pool.query(`INSERT INTO referrals (user_id, code) VALUES ($1, $2)`, [userId, code])
      return code
    } catch (err) {
      const e = err as { code?: string }
      if (e.code === '23505') continue // code/user collision — retry
      throw err
    }
  }
  throw new Error('could not allocate referral code')
}

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

export const referralsRouter = Router()
referralsRouter.use(requireSignedIn)

// The caller's invite code + how many sign-ups it has converted.
referralsRouter.get(
  '/referrals/me',
  wrap(async (req, res) => {
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)
    const code = await ensureCode(user.id)
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM referral_redemptions WHERE referrer_user_id = $1`,
      [user.id],
    )
    res.json({ code, successfulReferrals: Number(rows[0]?.count ?? 0) })
  }),
)

// Redeem a referral code (once per user). Rewards both parties on first redemption.
referralsRouter.post(
  '/referrals/redeem',
  writeLimiter,
  wrap(async (req, res) => {
    const code = (req.body as { code?: unknown })?.code
    if (typeof code !== 'string' || code.length === 0 || code.length > 64) {
      res.status(400).json({ error: 'Invalid code' })
      return
    }
    const { userId: clerkId } = getAuth(req)
    const user = await upsertUser(clerkId!)

    const ref = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM referrals WHERE code = $1`,
      [code],
    )
    const referrerId = ref.rows[0]?.user_id
    // Unknown code or self-referral: accept silently (no reward) so the client
    // flow stays simple and idempotent.
    if (!referrerId || referrerId === user.id) {
      res.json({ redeemed: false })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const inserted = await client.query(
        `INSERT INTO referral_redemptions (referred_user_id, referrer_user_id, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (referred_user_id) DO NOTHING`,
        [user.id, referrerId, code],
      )
      const isNew = inserted.rowCount === 1
      if (isNew) {
        // Reward both sides: XP + the recruiter badge.
        await awardXp(client, referrerId, REFERRAL_XP)
        await awardXp(client, user.id, REFERRAL_XP)
        await grantCosmetic(client, referrerId, REFERRER_BADGE)
        await grantCosmetic(client, user.id, REFERRER_BADGE)
        await syncRewards(client, referrerId)
        await syncRewards(client, user.id)
      }
      await client.query('COMMIT')
      res.json({ redeemed: isNew })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }),
)
