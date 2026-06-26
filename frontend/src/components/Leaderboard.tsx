import { useAuth, useUser } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getLeaderboard,
  getSeasons,
  type LeaderboardEntry,
  type LeaderboardScope,
  type LeaderboardWindow,
} from '../lib/api'
import { useRivals } from '../hooks/useRivals'
import type { TestMode } from '../hooks/useTypingTest'
import { TEST_MODES } from '../lib/modes'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from '../lib/words'

const WINDOW_LABELS: Record<LeaderboardWindow, string> = {
  all: 'All time',
  season: 'This season',
  week: 'This week',
  day: 'Today',
}

/** 'YYYY-MM' → 'June 2026'. */
function seasonLabel(id: string): string {
  const [y, m] = id.split('-').map(Number)
  if (!y || !m) return id
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// Framer Motion is allowed here — leaderboard and results screen only.
const list = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}
const row = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } },
}

const selectClass = 'rounded-md border border-border bg-surface px-2 py-1 text-fg'

export function Leaderboard() {
  const { user } = useUser()
  const { getToken, isSignedIn } = useAuth()
  const [keySet, setKeySet] = useState<KeySetId>('all')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [mode, setMode] = useState<TestMode>('words')
  const [window, setWindow] = useState<LeaderboardWindow>('all')
  const [scope, setScope] = useState<LeaderboardScope>('global')
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)
  const [error, setError] = useState(false)

  // Season archives (§12). null = current season; otherwise a 'YYYY-MM' archive.
  const [seasons, setSeasons] = useState<string[]>([])
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null)

  // Rivals (followees) — drives the Friends scope + list highlighting. Shared with
  // the profile Following card; errors surface instead of being swallowed.
  const {
    follows,
    followUsernames,
    query,
    results,
    error: rivalError,
    runSearch,
    addRival,
    removeRival,
  } = useRivals()

  const friendsGated = scope === 'friends' && !isSignedIn

  // Load the list of seasons once (for the archive picker).
  useEffect(() => {
    getSeasons()
      .then((r) => setSeasons(r.seasons))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (friendsGated) return // signed-out + friends: render the gate, don't fetch
    let cancelled = false
    setEntries(null)
    setError(false)
    const season = window === 'season' && selectedSeason ? selectedSeason : undefined
    getToken()
      .then((token) => getLeaderboard(token, keySet, difficulty, mode, window, scope, season))
      .then(({ entries }) => !cancelled && setEntries(entries))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [keySet, difficulty, mode, window, scope, selectedSeason, friendsGated, getToken])

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Leaderboard</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {/* Scope toggle */}
          <div className="flex overflow-hidden rounded-md border border-border">
            {(['global', 'friends'] as LeaderboardScope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`px-3 py-1 capitalize ${
                  scope === s ? 'bg-accent text-accent-contrast' : 'bg-surface text-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <select value={keySet} onChange={(e) => setKeySet(e.target.value as KeySetId)} className={selectClass}>
            {Object.entries(KEY_SETS).map(([id, k]) => (
              <option key={id} value={id}>{k.label}</option>
            ))}
          </select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className={selectClass}>
            {Object.entries(DIFFICULTIES).map(([id, d]) => (
              <option key={id} value={id}>{d.label}</option>
            ))}
          </select>
          <select value={mode} onChange={(e) => setMode(e.target.value as TestMode)} className={selectClass}>
            {Object.entries(TEST_MODES).map(([id, m]) => (
              <option key={id} value={id}>{m.label}</option>
            ))}
          </select>
          <select value={window} onChange={(e) => setWindow(e.target.value as LeaderboardWindow)} className={selectClass}>
            {Object.entries(WINDOW_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
          {/* Season archive picker — only when viewing seasons. */}
          {window === 'season' && seasons.length > 0 && (
            <select
              value={selectedSeason ?? ''}
              onChange={(e) => setSelectedSeason(e.target.value || null)}
              className={selectClass}
            >
              <option value="">This season</option>
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {seasonLabel(s)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Rival management — Friends scope, signed-in only. */}
      {scope === 'friends' && isSignedIn && (
        <div className="flex flex-col gap-3 rounded-md bg-surface-2 p-4">
          {rivalError && <p className="text-sm text-error">{rivalError}</p>}
          <div className="relative">
            <input
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Add a rival by username…"
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-fg"
            />
            {results.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
                {results.map((u) => {
                  const already = follows.some((f) => f.id === u.id)
                  return (
                    <li key={u.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span className="truncate text-fg">{u.username}</span>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() => addRival(u)}
                        className="text-xs text-accent disabled:text-faint"
                      >
                        {already ? 'Following' : 'Follow'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          {follows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {follows.map((f) => (
                <span key={f.id} className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs text-fg">
                  {f.username}
                  <button
                    type="button"
                    onClick={() => removeRival(f)}
                    className="text-muted hover:text-error"
                    aria-label={`Unfollow ${f.username}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {friendsGated && (
        <p className="text-sm text-muted">Sign in to compare with friends.</p>
      )}
      {error && <p className="text-sm text-error">Could not load the leaderboard.</p>}
      {!friendsGated && !error && entries === null && <p className="text-sm text-muted">Loading…</p>}
      {!friendsGated && entries?.length === 0 && (
        <p className="text-sm text-muted">
          {scope === 'friends'
            ? 'No scores from your rivals yet — add some above or set the pace.'
            : 'No entries yet for this mode — set the first score!'}
        </p>
      )}

      {!friendsGated && entries && entries.length > 0 && (
        <motion.ol variants={list} initial="hidden" animate="show" className="flex flex-col">
          {entries.map((e, i) => {
            const isMe = user?.username != null && e.username === user.username
            const isRival = !isMe && e.username != null && followUsernames.has(e.username)
            return (
              <motion.li
                key={`${e.username}-${i}`}
                variants={row}
                className={`flex items-baseline gap-4 border-t border-border py-2 first:border-t-0 ${
                  isMe ? 'rounded bg-accent/10 px-2' : isRival ? 'rounded bg-surface-2 px-2' : ''
                }`}
              >
                <span className={`w-8 text-right font-mono ${i < 3 ? 'text-accent' : 'text-muted'}`}>
                  {i + 1}
                </span>
                <span className={`flex-1 truncate ${isMe ? 'font-semibold text-accent' : 'text-fg'}`}>
                  {e.username ? (
                    <Link to={`/u/${encodeURIComponent(e.username)}`} className="hover:underline">
                      {e.username}
                    </Link>
                  ) : (
                    'anonymous'
                  )}
                  {isRival && <span className="ml-2 text-xs text-muted">rival</span>}
                </span>
                <span className="font-mono text-lg font-bold text-fg">
                  {Number(e.wpm).toFixed(0)}
                  <span className="ml-1 text-xs font-normal text-muted">wpm</span>
                </span>
                <span className="w-16 text-right text-sm text-muted">
                  {Number(e.accuracy).toFixed(1)}%
                </span>
              </motion.li>
            )
          })}
        </motion.ol>
      )}
    </div>
  )
}
