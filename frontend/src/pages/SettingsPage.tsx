import { SignedIn, SignedOut, useAuth, useUser } from '@clerk/clerk-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { AccountManager } from '../components/AccountManager'
import { KeyboardVisual } from '../components/KeyboardVisual'
import { usePreferences } from '../hooks/usePreferences'
import { ApiError, getMe, updateUsername } from '../lib/api'
import { comboFromEvent, formatCombo, isModifierOnly } from '../lib/hotkeys'
import { getLayout, KEYBOARD_LAYOUTS, type LayoutId } from '../lib/keyboard'
import {
  CODE_LANGUAGES,
  DAILY_GOALS,
  FONTS,
  HOTKEYS,
  THEMES,
  defaultHotkeys,
  type CodeLanguage,
  type FontId,
  type HotkeyAction,
  type Theme,
} from '../lib/preferences'

export function SettingsPage() {
  const { t } = useTranslation()
  const { prefs, update, reset } = usePreferences()
  const previewLayout = useMemo(() => getLayout(prefs.keyboardLayout), [prefs.keyboardLayout])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      {/* Appearance: theme + test font with a live preview. */}
      <Card title={t('settings.appearance')}>
        <Field label={t('settings.theme')}>
          <select
            value={prefs.theme}
            onChange={(e) => update({ theme: e.target.value as Theme })}
            className={selectClass}
          >
            {(Object.keys(THEMES) as Theme[]).map((id) => (
              <option key={id} value={id}>
                {THEMES[id].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('settings.font')} hint={t('settings.fontHint')}>
          <select
            value={prefs.font}
            onChange={(e) => update({ font: e.target.value as FontId })}
            className={selectClass}
          >
            {(Object.keys(FONTS) as FontId[]).map((id) => (
              <option key={id} value={id}>
                {FONTS[id].label}
              </option>
            ))}
          </select>
        </Field>

        <div
          className="rounded-lg bg-surface-2 px-5 py-4 text-2xl text-fg"
          style={{ fontFamily: FONTS[prefs.font].stack }}
        >
          {t('settings.fontPreview')}
        </div>
      </Card>

      {/* Keyboard: layout selector with a live re-render of the visual board. */}
      <Card title={t('settings.keyboard')}>
        <Field label={t('settings.layout')} hint={t('settings.layoutHint')}>
          <select
            value={prefs.keyboardLayout}
            onChange={(e) => update({ keyboardLayout: e.target.value as LayoutId })}
            className={selectClass}
          >
            {(Object.keys(KEYBOARD_LAYOUTS) as LayoutId[]).map((id) => (
              <option key={id} value={id}>
                {KEYBOARD_LAYOUTS[id].label}
              </option>
            ))}
          </select>
        </Field>

        <div className="overflow-x-auto">
          <div className="min-w-fit origin-top-left scale-90">
            <KeyboardVisual nextChar={null} flashKeyId={null} showInfo={false} layout={previewLayout} />
          </div>
        </div>
      </Card>

      {/* Goals: daily practice target that drives the streak ring. */}
      <Card title="Goals">
        <Field label="Daily goal" hint="Minutes of practice per day for the streak ring.">
          <select
            value={prefs.dailyGoal}
            onChange={(e) => update({ dailyGoal: Number(e.target.value) })}
            className={selectClass}
          >
            {DAILY_GOALS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'No goal' : `${m} min`}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      {/* Typing test: content options for the test modes. */}
      <Card title={t('settings.typingTest')}>
        <Field label={t('settings.codeLanguage')} hint={t('settings.codeLanguageHint')}>
          <select
            value={prefs.codeLanguage}
            onChange={(e) => update({ codeLanguage: e.target.value as CodeLanguage })}
            className={selectClass}
          >
            {(Object.keys(CODE_LANGUAGES) as CodeLanguage[]).map((id) => (
              <option key={id} value={id}>
                {CODE_LANGUAGES[id].label}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      {/* Hotkeys: rebindable site shortcuts. */}
      <HotkeysCard />

      {/* Account: username + where preferences live. */}
      <Card title={t('settings.account')}>
        <SignedOut>
          <p className="text-sm text-muted">{t('settings.accountGuest')}</p>
        </SignedOut>
        <SignedIn>
          <UsernameEditor />
          <p className="text-sm text-muted">{t('settings.accountSynced')}</p>
        </SignedIn>
      </Card>

      {/* Self-service email / connected-accounts / password / delete, replacing
          Clerk's hosted account modal. Signed-in only. */}
      <SignedIn>
        <AccountManager />
      </SignedIn>

      <div>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted transition-colors hover:bg-surface"
        >
          {t('common.reset')}
        </button>
      </div>
    </div>
  )
}

/** Rebindable hotkeys. Each row captures the next keypress to set its combo. */
function HotkeysCard() {
  const { prefs, update } = usePreferences()
  const [capturing, setCapturing] = useState<HotkeyAction | null>(null)
  const actions = Object.keys(HOTKEYS) as HotkeyAction[]

  useEffect(() => {
    if (!capturing) return
    // Capture phase so we beat the global nav/restart listeners and Escape cancels.
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setCapturing(null)
        return
      }
      if (isModifierOnly(e)) return
      update({ hotkeys: { ...prefs.hotkeys, [capturing]: comboFromEvent(e) } })
      setCapturing(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [capturing, prefs.hotkeys, update])

  return (
    <Card title="Hotkeys">
      {actions.map((action) => (
        <Field key={action} label={HOTKEYS[action].label}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCapturing(action)}
              className={`min-w-[6rem] rounded-md border px-3 py-1.5 text-sm ${
                capturing === action
                  ? 'border-accent text-accent'
                  : 'border-border bg-surface text-fg'
              }`}
            >
              {capturing === action ? 'Press a key…' : formatCombo(prefs.hotkeys[action])}
            </button>
            <button
              type="button"
              onClick={() =>
                update({ hotkeys: { ...prefs.hotkeys, [action]: defaultHotkeys()[action] } })
              }
              className="text-xs text-muted underline hover:text-fg"
            >
              Reset
            </button>
          </div>
        </Field>
      ))}
    </Card>
  )
}

/** Username editor. Changes go through the backend (gated to once per week);
 *  Clerk stays the uniqueness/format authority. On success we reload Clerk's
 *  client cache so the leaderboard/rivals reflect the new name. */
function UsernameEditor() {
  const { t } = useTranslation()
  const { user } = useUser()
  const { getToken } = useAuth()
  const [value, setValue] = useState('')
  const [seeded, setSeeded] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)
  // ISO timestamp when the next rename is allowed, or null if not locked.
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)

  // Surface the lock state up front. The backend enforces it regardless, so a
  // failed load is harmless — the user just sees no banner until they try.
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { user: row } = await getMe(await getToken())
        if (active) setLockedUntil(lockUntil(row.username_changed_at))
      } catch {
        /* non-fatal */
      }
    })()
    return () => {
      active = false
    }
  }, [getToken])

  // Seed the input from Clerk's username, re-seeding if it changes (resolves
  // after mount, or is updated here). Adjusting state during render is React's
  // sanctioned alternative to a setState-in-effect cascade.
  const current = user?.username ?? ''
  if (user && current !== seeded) {
    setSeeded(current)
    setValue(current)
  }

  if (!user) return null

  const trimmed = value.trim()
  // `lockedUntil` is only ever set to a future time (lockUntil/the backend return
  // null when not locked), so its presence is the lock signal — no Date.now() here.
  const locked = lockedUntil !== null
  const dirty = trimmed.length > 0 && trimmed !== current

  const save = async () => {
    setStatus('saving')
    setError(null)
    try {
      const { nextChangeAllowedAt } = await updateUsername(await getToken(), trimmed)
      setLockedUntil(nextChangeAllowedAt)
    } catch (err) {
      setStatus('idle')
      if (err instanceof ApiError && err.status === 409) setError(t('settings.usernameTaken'))
      else if (err instanceof ApiError && err.status === 429) {
        setError(err.message)
        // Lock the UI to match what the backend just enforced.
        try {
          const { user: row } = await getMe(await getToken())
          setLockedUntil(lockUntil(row.username_changed_at))
        } catch {
          /* ignore */
        }
      } else setError(err instanceof ApiError && err.message ? err.message : t('settings.usernameInvalid'))
      return
    }
    // Reflect the new name in Clerk's client cache; it also re-syncs server-side
    // on the next authed request, so a failure here is harmless.
    try {
      await user.reload()
    } catch {
      /* ignore */
    }
    setStatus('saved')
  }

  return (
    <Field label={t('settings.username')} hint={t('settings.usernameHint')}>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <input
            value={value}
            disabled={locked}
            onChange={(e) => {
              setValue(e.target.value)
              setStatus('idle')
              setError(null)
            }}
            placeholder={t('settings.usernamePlaceholder')}
            spellCheck={false}
            autoComplete="off"
            className={`${selectClass} disabled:opacity-50`}
          />
          <button
            type="button"
            disabled={!dirty || locked || status === 'saving'}
            onClick={save}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {status === 'saving' ? t('settings.usernameSaving') : t('settings.usernameSave')}
          </button>
        </div>
        {status === 'saved' && <span className="text-xs text-accent">{t('settings.usernameSaved')}</span>}
        {locked && lockedUntil && (
          <span className="text-xs text-muted">
            {t('settings.usernameLocked', { date: formatDate(lockedUntil) })}
          </span>
        )}
        {error && <span className="text-xs text-error">{error}</span>}
      </div>
    </Field>
  )
}

const RENAME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/** Next-allowed rename timestamp from a last-change time, or null if not locked. */
function lockUntil(changedAt: string | null): string | null {
  if (!changedAt) return null
  const next = new Date(changedAt).getTime() + RENAME_WINDOW_MS
  return next > Date.now() ? new Date(next).toISOString() : null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const selectClass =
  'rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-fg'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-fg">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

