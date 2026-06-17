import { useAuth, useUser } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, updateUsername } from '../lib/api'

/**
 * Mandatory-username gate. A signed-in user with no username gets a blocking
 * modal that forces them to pick one before using the app — this backstops
 * Clerk's "username required" sign-up setting for OAuth/legacy accounts that
 * slip through with none. The initial set is exempt from the once-per-week
 * limit. Renders nothing once a username exists (or while signed out).
 */
export function UsernameGate() {
  const { t } = useTranslation()
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isLoaded || !user || user.username) return null

  const trimmed = value.trim()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!trimmed || saving) return
    setSaving(true)
    setError(null)
    try {
      await updateUsername(await getToken(), trimmed)
      await user.reload() // clears the gate
    } catch (err) {
      setSaving(false)
      if (err instanceof ApiError && err.status === 409) setError(t('settings.usernameTaken'))
      // Surface Clerk's actual reason (the backend forwards it) so the user
      // isn't told a valid name is "invalid".
      else if (err instanceof ApiError && err.message) setError(err.message)
      else setError(t('settings.usernameInvalid'))
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-2 text-center text-xl font-bold text-fg">{t('usernameGate.title')}</h2>
        <p className="mb-5 text-center text-sm text-muted">{t('usernameGate.body')}</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
            placeholder={t('settings.usernamePlaceholder')}
            spellCheck={false}
            autoComplete="off"
            autoFocus
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-fg"
          />
          <button
            type="submit"
            disabled={!trimmed || saving}
            className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-contrast transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? t('usernameGate.saving') : t('usernameGate.cta')}
          </button>
          {error && <span className="text-center text-xs text-error">{error}</span>}
        </form>
      </motion.div>
    </motion.div>
  )
}
