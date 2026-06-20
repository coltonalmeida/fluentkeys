import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { pool } from './db.js'
import { renderCardPng } from './ogcard.js'

// Shareable result cards (§1). A public result page with an auto-generated Open
// Graph image so links unfurl richly. Share links point at THIS (backend) origin
// so crawlers get per-result meta; humans are redirected to the SPA.

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

const ID_RE = /^\d+$/

// Bounded LRU cache of rendered OG cards (a card is immutable for a result id).
// Caps memory (~200 × ~36 KB ≈ 7 MB) and avoids re-rendering popular cards. The
// rate limiter below caps render-triggering abuse from a single IP.
const CARD_CACHE_MAX = 200
const cardCache = new Map<string, Buffer>()

function cardCacheGet(id: string): Buffer | undefined {
  const png = cardCache.get(id)
  if (png === undefined) return undefined
  // Mark most-recently-used.
  cardCache.delete(id)
  cardCache.set(id, png)
  return png
}

function cardCacheSet(id: string, png: Buffer): void {
  cardCache.set(id, png)
  if (cardCache.size > CARD_CACHE_MAX) {
    const oldest = cardCache.keys().next().value
    if (oldest !== undefined) cardCache.delete(oldest)
  }
}

// Image rendering is the only CPU-heavy public route — cap it per IP (on top of
// the global limiter). 30/min is far above any legitimate share-unfurl traffic.
const cardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

interface ResultRow {
  id: string
  wpm: string
  accuracy: string
  raw_wpm: string
  created_at: string
  key_set: string
  difficulty: string
  duration: number
  username: string | null
}

async function fetchResult(id: string): Promise<ResultRow | null> {
  const { rows } = await pool.query<ResultRow>(
    `SELECT r.id, r.wpm, r.accuracy, r.raw_wpm, r.created_at,
            s.key_set, s.difficulty, s.duration, u.username
     FROM results r
     JOIN test_sessions s ON s.id = r.session_id
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.id = $1`,
    [id],
  )
  return rows[0] ?? null
}

/** Deployed frontend origin for the human redirect (prod). Falls back to the
 *  first CORS origin; empty in local dev (we then just render the OG page). */
function webOrigin(): string {
  if (process.env.PUBLIC_WEB_ORIGIN) return process.env.PUBLIC_WEB_ORIGIN.replace(/\/$/, '')
  const cors = process.env.CORS_ORIGIN?.split(',')[0]?.trim()
  return cors ? cors.replace(/\/$/, '') : ''
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const shareRouter = Router()

// Public result JSON (privacy-trimmed) — powers the SPA shared-result page.
shareRouter.get(
  '/results/:id',
  wrap(async (req, res) => {
    const id = String(req.params.id)
    if (!ID_RE.test(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }
    const r = await fetchResult(id)
    if (!r) {
      res.status(404).json({ error: 'Result not found' })
      return
    }
    res.json({
      id: r.id,
      username: r.username,
      wpm: Number(r.wpm),
      accuracy: Number(r.accuracy),
      rawWpm: Number(r.raw_wpm),
      keySet: r.key_set,
      difficulty: r.difficulty,
      duration: r.duration,
      createdAt: r.created_at,
    })
  }),
)

// Open Graph card image.
shareRouter.get(
  '/r/:id/card.png',
  cardLimiter,
  wrap(async (req, res) => {
    const id = String(req.params.id)
    if (!ID_RE.test(id)) {
      res.status(400).end()
      return
    }
    const sendPng = (png: Buffer) => {
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.end(png)
    }

    // Serve a previously rendered card without touching the DB or re-rendering.
    const cached = cardCacheGet(id)
    if (cached) {
      sendPng(cached)
      return
    }

    const r = await fetchResult(id)
    if (!r) {
      res.status(404).end()
      return
    }
    const png = renderCardPng({
      wpm: Number(r.wpm),
      accuracy: Number(r.accuracy),
      detail: `${r.key_set} · ${r.difficulty} · ${r.duration}s`,
      username: r.username ?? 'anonymous',
    })
    cardCacheSet(id, png)
    sendPng(png)
  }),
)

// HTML shell with OG/Twitter meta for crawlers; humans get redirected to the SPA.
shareRouter.get(
  '/r/:id',
  wrap(async (req, res) => {
    const id = String(req.params.id)
    if (!ID_RE.test(id)) {
      res.status(400).type('html').send('<!doctype html><p>Invalid result.</p>')
      return
    }
    const r = await fetchResult(id)
    if (!r) {
      res.status(404).type('html').send('<!doctype html><p>Result not found.</p>')
      return
    }
    const origin = `${req.protocol}://${req.get('host')}`
    const img = `${origin}/r/${id}/card.png`
    const wpm = Math.round(Number(r.wpm))
    const acc = Number(r.accuracy).toFixed(1)
    const who = escapeHtml(r.username ?? 'A FluentKeys player')
    const title = `${wpm} WPM · ${acc}% — FluentKeys`
    const desc = `${who} typed ${wpm} WPM at ${acc}% accuracy. Can you beat it?`
    const web = webOrigin()
    const target = web ? `${web}/r/${id}` : ''

    res.type('html').send(
      `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(desc)}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(desc)}" />
<meta name="twitter:image" content="${img}" />
${target ? `<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}" />` : ''}
</head>
<body style="font-family: system-ui, sans-serif; background:#18181b; color:#f4f4f5; text-align:center; padding:3rem;">
<h1>${wpm} WPM · ${acc}%</h1>
<p>${escapeHtml(desc)}</p>
${target ? `<p><a style="color:#34d399" href="${escapeHtml(target)}">Open on FluentKeys →</a></p>` : ''}
</body>
</html>`,
    )
  }),
)
