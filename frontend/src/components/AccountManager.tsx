import { useReverification, useUser } from '@clerk/clerk-react'
import { isReverificationCancelledError } from '@clerk/clerk-react/errors'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

/** The resolved Clerk user, derived from the hook so we avoid importing @clerk/types. */
type ClerkUser = NonNullable<ReturnType<typeof useUser>['user']>
type EmailResource = ClerkUser['emailAddresses'][number]
type ExternalResource = ClerkUser['externalAccounts'][number]

/**
 * Self-service account management, rendered inside our own Settings page so users
 * never touch Clerk's hosted modal. Emails, connected accounts, password and
 * account deletion all run through Clerk's client SDK. Sensitive actions are
 * wrapped in `useReverification`, which shows Clerk's prebuilt step-up prompt
 * when the session's verification has gone stale (>10 min).
 */
export function AccountManager() {
  const { user, isLoaded } = useUser()
  if (!isLoaded || !user) return null
  return (
    <>
      <EmailSection user={user} />
      <ConnectedAccountsSection user={user} />
      <PasswordSection user={user} />
      <DangerSection user={user} />
    </>
  )
}

/** Swallows a user-cancelled reverification; rethrows everything else so the
 *  caller can surface a real error. */
function isCancelled(err: unknown): boolean {
  return isReverificationCancelledError(err)
}

function EmailSection({ user }: { user: ClerkUser }) {
  const createEmail = useReverification((email: string) => user.createEmailAddress({ email }))
  const makePrimary = useReverification((id: string) => user.update({ primaryEmailAddressId: id }))
  const removeEmail = useReverification((email: EmailResource) => email.destroy())

  const [adding, setAdding] = useState('')
  const [pending, setPending] = useState<EmailResource | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await user.reload()
    } catch (err) {
      if (!isCancelled(err)) setError(clerkMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const startAdd = async () => {
    const email = adding.trim()
    if (!email) return
    setBusy(true)
    setError(null)
    try {
      const created = await createEmail(email)
      // `created` is null only if reverification was cancelled mid-flow.
      if (!created) return
      await created.prepareVerification({ strategy: 'email_code' })
      setPending(created)
    } catch (err) {
      if (!isCancelled(err)) setError(clerkMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const confirmCode = async () => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      await pending.attemptVerification({ code: code.trim() })
      await user.reload()
      setPending(null)
      setAdding('')
      setCode('')
    } catch (err) {
      setError(clerkMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SubSection title="Email addresses">
      <ul className="flex flex-col gap-2">
        {user.emailAddresses.map((email) => {
          const isPrimary = email.id === user.primaryEmailAddressId
          const verified = email.verification.status === 'verified'
          return (
            <li key={email.id} className={rowClass}>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate text-sm text-fg">{email.emailAddress}</span>
                {isPrimary && <Badge>Primary</Badge>}
                {!verified && <Badge tone="warn">Unverified</Badge>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {verified && !isPrimary && (
                  <LinkButton onClick={() => run(() => makePrimary(email.id))} disabled={busy}>
                    Make primary
                  </LinkButton>
                )}
                {!isPrimary && (
                  <LinkButton tone="error" onClick={() => run(() => removeEmail(email))} disabled={busy}>
                    Remove
                  </LinkButton>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {pending ? (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
          <p className="text-sm text-muted">
            Enter the code we sent to <span className="text-fg">{pending.emailAddress}</span>.
          </p>
          <div className="flex items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className={inputClass}
            />
            <button type="button" disabled={busy || !code.trim()} onClick={confirmCode} className={primaryBtn}>
              Verify
            </button>
            <LinkButton
              onClick={() => {
                setPending(null)
                setCode('')
              }}
              disabled={busy}
            >
              Cancel
            </LinkButton>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder="you@example.com"
            type="email"
            autoComplete="off"
            className={inputClass}
          />
          <button type="button" disabled={busy || !adding.trim()} onClick={startAdd} className={primaryBtn}>
            Add email
          </button>
        </div>
      )}

      {error && <p className="text-xs text-error">{error}</p>}
    </SubSection>
  )
}

function ConnectedAccountsSection({ user }: { user: ClerkUser }) {
  const connect = useReverification(() =>
    user.createExternalAccount({ strategy: 'oauth_google', redirectUrl: window.location.href }),
  )
  const disconnect = useReverification((account: ExternalResource) => account.destroy())

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accounts = user.externalAccounts
  const hasGoogle = accounts.some((a) => a.provider === 'google')

  const connectGoogle = async () => {
    setBusy(true)
    setError(null)
    try {
      const account = await connect()
      const url = account?.verification?.externalVerificationRedirectURL
      if (url) {
        window.location.href = url.toString()
        return
      }
      setError('Could not start the Google connection.')
    } catch (err) {
      if (!isCancelled(err)) setError(clerkMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (account: ExternalResource) => {
    setBusy(true)
    setError(null)
    try {
      await disconnect(account)
      await user.reload()
    } catch (err) {
      if (!isCancelled(err)) setError(clerkMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SubSection title="Connected accounts">
      {accounts.length === 0 && <p className="text-sm text-muted">No connected accounts.</p>}
      <ul className="flex flex-col gap-2">
        {accounts.map((account) => (
          <li key={account.id} className={rowClass}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-fg">{providerLabel(account.provider)}</span>
              {account.emailAddress && (
                <span className="truncate text-sm text-muted">{account.emailAddress}</span>
              )}
            </div>
            <LinkButton tone="error" onClick={() => remove(account)} disabled={busy}>
              Disconnect
            </LinkButton>
          </li>
        ))}
      </ul>
      {!hasGoogle && (
        <button type="button" disabled={busy} onClick={connectGoogle} className={secondaryBtn}>
          Connect Google
        </button>
      )}
      {error && <p className="text-xs text-error">{error}</p>}
    </SubSection>
  )
}

function PasswordSection({ user }: { user: ClerkUser }) {
  const savePassword = useReverification(
    (params: { currentPassword?: string; newPassword: string }) =>
      user.updatePassword({ ...params, signOutOfOtherSessions: true }),
  )
  const removePassword = useReverification((currentPassword: string) =>
    user.removePassword({ currentPassword }),
  )

  const hasPassword = user.passwordEnabled
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    if (!next) return
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await savePassword({ newPassword: next, ...(hasPassword ? { currentPassword: current } : {}) })
      setCurrent('')
      setNext('')
      setSaved(true)
    } catch (err) {
      if (!isCancelled(err)) setError(clerkMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await removePassword(current)
      await user.reload()
      setCurrent('')
    } catch (err) {
      if (!isCancelled(err)) setError(clerkMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SubSection title="Password">
      <p className="text-sm text-muted">
        {hasPassword
          ? 'Change or remove your password.'
          : 'You sign in with Google. Add a password to also sign in with your email.'}
      </p>
      <div className="flex flex-col gap-2">
        {hasPassword && (
          <input
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Current password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
          />
        )}
        <input
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={hasPassword ? 'New password' : 'Password'}
          type="password"
          autoComplete="new-password"
          className={inputClass}
        />
        <div className="flex items-center gap-3">
          <button type="button" disabled={busy || !next} onClick={save} className={primaryBtn}>
            {hasPassword ? 'Change password' : 'Set password'}
          </button>
          {hasPassword && (
            <LinkButton tone="error" onClick={remove} disabled={busy || !current}>
              Remove password
            </LinkButton>
          )}
          {saved && <span className="text-xs text-accent">Saved</span>}
        </div>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </SubSection>
  )
}

function DangerSection({ user }: { user: ClerkUser }) {
  const deleteAccount = useReverification(() => user.delete())
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteAccount()
      // The account (and our DB rows, via the user.deleted webhook) are gone and
      // the session is invalid — send them home.
      navigate('/')
    } catch (err) {
      if (!isCancelled(err)) setError(clerkMessage(err))
      setBusy(false)
    }
  }

  return (
    <SubSection title="Delete account">
      <p className="text-sm text-muted">
        Permanently delete your account and all your data — results, personal bests, leaderboard
        entries, and history. This cannot be undone.
      </p>
      {confirming ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="rounded-md bg-error px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Yes, delete my account'}
          </button>
          <LinkButton onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </LinkButton>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="self-start rounded-md border border-error px-3 py-1.5 text-sm font-semibold text-error transition-colors hover:bg-error hover:text-white"
        >
          Delete account
        </button>
      )}
      {error && <p className="text-xs text-error">{error}</p>}
    </SubSection>
  )
}

/* ── shared UI ──────────────────────────────────────────────────────────── */

const inputClass = 'min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-fg'
const primaryBtn =
  'shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent/90 disabled:opacity-50'
const secondaryBtn =
  'self-start rounded-md border border-border px-3 py-1.5 text-sm text-fg transition-colors hover:bg-surface-2 disabled:opacity-50'
const rowClass = 'flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2'

/** A divided sub-section within the single Account card. The top border acts as
 *  the separator between consecutive account controls. */
function SubSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">{title}</h3>
      {children}
    </div>
  )
}

function Badge({ children, tone }: { children: ReactNode; tone?: 'warn' }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs ${
        tone === 'warn' ? 'bg-error/15 text-error' : 'bg-border text-muted'
      }`}
    >
      {children}
    </span>
  )
}

function LinkButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'error'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-sm underline transition-colors disabled:opacity-50 ${
        tone === 'error' ? 'text-error hover:opacity-80' : 'text-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}

/** Pull a human message out of a Clerk error (its `errors[0]` long/short message). */
function clerkMessage(err: unknown): string {
  const errors =
    typeof err === 'object' && err !== null && 'errors' in err
      ? (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors
      : undefined
  return errors?.[0]?.longMessage ?? errors?.[0]?.message ?? 'Something went wrong. Please try again.'
}

function providerLabel(provider: string): string {
  const name = provider.replace(/^oauth_/, '')
  return name.charAt(0).toUpperCase() + name.slice(1)
}
