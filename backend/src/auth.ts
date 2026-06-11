import bcrypt from 'bcryptjs'
import { Router, type NextFunction, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import { pool } from './db.js'

const JWT_EXPIRES_IN = '7d'

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET env var is not set')
  return secret
}

export interface AuthedRequest extends Request {
  userId?: number
}

interface TokenPayload {
  sub: string
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret()) as TokenPayload
    req.userId = Number(payload.sub)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

const issueToken = (userId: number): string =>
  jwt.sign({ sub: String(userId) }, jwtSecret(), { expiresIn: JWT_EXPIRES_IN })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export const authRouter = Router()

authRouter.post('/register', async (req, res) => {
  const { email, username, password } = req.body as Record<string, unknown>
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Invalid email' })
    return
  }
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    res.status(400).json({ error: 'Username must be 3-20 chars (letters, digits, underscore)' })
    return
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  try {
    const { rows } = await pool.query<{ id: number; email: string; username: string }>(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3) RETURNING id, email, username`,
      [email.toLowerCase(), username, passwordHash],
    )
    const user = rows[0]
    if (!user) throw new Error('insert returned no row')
    res.status(201).json({ token: issueToken(user.id), user })
  } catch (err: unknown) {
    // 23505 = unique_violation (email or username taken)
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') {
      res.status(409).json({ error: 'Email or username already taken' })
      return
    }
    console.error('register failed:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Express 4 doesn't catch async errors; wrap handlers that hit the DB.
const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

authRouter.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body as Record<string, unknown>
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  const { rows } = await pool.query<{
    id: number
    email: string
    username: string
    password_hash: string
  }>(`SELECT id, email, username, password_hash FROM users WHERE email = $1`, [
    email.toLowerCase(),
  ])
  const user = rows[0]
  // Same error for unknown email and wrong password — don't leak which.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }
  res.json({
    token: issueToken(user.id),
    user: { id: user.id, email: user.email, username: user.username },
  })
}))

// Protected route to confirm the token flow end to end.
authRouter.get('/me', requireAuth, wrap(async (req, res) => {
  const { rows } = await pool.query<{ id: number; email: string; username: string }>(
    `SELECT id, email, username FROM users WHERE id = $1`,
    [req.userId],
  )
  const user = rows[0]
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({ user })
}))
