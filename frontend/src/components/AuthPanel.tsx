import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ApiError } from '../lib/api'

interface AuthPanelProps {
  onClose: () => void
}

export function AuthPanel({ onClose }: AuthPanelProps) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, username, password)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500'

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-80 flex-col gap-3 rounded-lg bg-zinc-800 p-6 shadow-xl"
      >
        <div className="mb-2 flex gap-4 text-sm">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={mode === 'login' ? 'font-semibold text-emerald-400' : 'text-zinc-400'}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={mode === 'signup' ? 'font-semibold text-emerald-400' : 'text-zinc-400'}
          >
            Sign up
          </button>
        </div>

        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        {mode === 'signup' && (
          <input
            type="text"
            required
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        )}
        <input
          type="password"
          required
          minLength={mode === 'signup' ? 8 : undefined}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-md bg-emerald-500 py-2 font-semibold text-zinc-900 hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
