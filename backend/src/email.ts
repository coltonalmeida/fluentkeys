import crypto from 'crypto'

// Email re-engagement (§10), built INERT: with no RESEND_API_KEY the sender is a
// no-op that just logs, so the whole system is dormant until keyed. Sends go via
// Resend's REST API (no SDK dependency) using the global fetch.

const FROM = process.env.EMAIL_FROM ?? 'FluentKeys <noreply@fluentkeys.app>'

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

/** Send one email. Returns whether it was actually dispatched. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log(`[email] disabled — would send "${subject}" to ${to}`)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    if (!res.ok) {
      console.error('[email] send failed', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[email] send error', err)
    return false
  }
}

// --- Unsubscribe tokens -----------------------------------------------------

function unsubSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET ?? 'fluentkeys-dev-secret'
}

/** Stateless, verifiable unsubscribe token for a user id. */
export function unsubscribeToken(userId: string): string {
  const mac = crypto.createHmac('sha256', unsubSecret()).update(userId).digest('base64url')
  return `${userId}.${mac}`
}

/** Returns the user id if the token is valid, else null. */
export function verifyUnsubscribeToken(token: string): string | null {
  const [userId, mac] = token.split('.')
  if (!userId || !mac) return null
  const expected = crypto.createHmac('sha256', unsubSecret()).update(userId).digest('base64url')
  // Constant-time compare.
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return userId
}

function webOrigin(): string {
  if (process.env.PUBLIC_WEB_ORIGIN) return process.env.PUBLIC_WEB_ORIGIN.replace(/\/$/, '')
  const cors = process.env.CORS_ORIGIN?.split(',')[0]?.trim()
  return cors ? cors.replace(/\/$/, '') : ''
}

/** Backend origin for tokenized links (the unsubscribe endpoint lives here). */
function apiOrigin(): string {
  return (process.env.PUBLIC_API_ORIGIN ?? '').replace(/\/$/, '')
}

function shell(body: string, userId: string): string {
  const unsub = `${apiOrigin()}/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken(userId))}`
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#18181b">
    <h1 style="color:#16a34a">FluentKeys</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0" />
    <p style="font-size:12px;color:#71717a">
      You're getting this because you have a FluentKeys account.
      <a href="${unsub}" style="color:#71717a">Unsubscribe</a>.
    </p>
  </div>`
}

// --- Templates --------------------------------------------------------------

export function digestEmail(
  userId: string,
  d: { topWpm: number; tests: number; activeDays: number },
): {
  subject: string
  html: string
} {
  const web = webOrigin()
  return {
    subject: `Your week on FluentKeys — ${d.tests} tests, ${Math.round(d.topWpm)} top WPM`,
    html: shell(
      `<p>Here's your week:</p>
       <ul>
         <li><strong>${d.tests}</strong> tests completed</li>
         <li><strong>${Math.round(d.topWpm)}</strong> WPM top speed</li>
         <li>practiced on <strong>${d.activeDays}</strong> day${d.activeDays === 1 ? '' : 's'}</li>
       </ul>
       <p><a href="${web}" style="color:#16a34a;font-weight:600">Keep it going →</a></p>`,
      userId,
    ),
  }
}

export function rivalEmail(userId: string, d: { rival: string; wpm: number }): {
  subject: string
  html: string
} {
  const web = webOrigin()
  return {
    subject: `${d.rival} just beat your best on FluentKeys`,
    html: shell(
      `<p><strong>${d.rival}</strong> hit ${Math.round(d.wpm)} WPM — ahead of your personal best.</p>
       <p><a href="${web}/leaderboard" style="color:#16a34a;font-weight:600">Reclaim your spot →</a></p>`,
      userId,
    ),
  }
}

export function streakEmail(userId: string, d: { streak: number }): { subject: string; html: string } {
  const web = webOrigin()
  return {
    subject: `Don't break your ${d.streak}-day streak!`,
    html: shell(
      `<p>Your <strong>${d.streak}-day</strong> streak ends at midnight. A quick test keeps it alive.</p>
       <p><a href="${web}" style="color:#16a34a;font-weight:600">Practice now →</a></p>`,
      userId,
    ),
  }
}
