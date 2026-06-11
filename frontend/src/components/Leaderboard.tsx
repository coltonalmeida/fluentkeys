import { useUser } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  getLeaderboard,
  type LeaderboardEntry,
  type LeaderboardWindow,
} from '../lib/api'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from '../lib/words'

const WINDOW_LABELS: Record<LeaderboardWindow, string> = {
  all: 'All time',
  week: 'This week',
  day: 'Today',
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

export function Leaderboard() {
  const { user } = useUser()
  const [keySet, setKeySet] = useState<KeySetId>('all')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [window, setWindow] = useState<LeaderboardWindow>('all')
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setError(false)
    getLeaderboard(keySet, difficulty, window)
      .then(({ entries }) => !cancelled && setEntries(entries))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [keySet, difficulty, window])

  const selectClass = 'rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100'

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-zinc-200/60 dark:bg-zinc-800/50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Leaderboard
        </h2>
        <div className="flex gap-2 text-sm">
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
          <select value={window} onChange={(e) => setWindow(e.target.value as LeaderboardWindow)} className={selectClass}>
            {Object.entries(WINDOW_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">Could not load the leaderboard.</p>}
      {!error && entries === null && <p className="text-sm text-zinc-500">Loading…</p>}
      {entries?.length === 0 && (
        <p className="text-sm text-zinc-500">No entries yet for this mode — set the first score!</p>
      )}

      {entries && entries.length > 0 && (
        <motion.ol variants={list} initial="hidden" animate="show" className="flex flex-col">
          {entries.map((e, i) => {
            const isMe = user?.username != null && e.username === user.username
            return (
              <motion.li
                key={`${e.username}-${i}`}
                variants={row}
                className={`flex items-baseline gap-4 border-t border-zinc-300 dark:border-zinc-700/50 py-2 first:border-t-0 ${
                  isMe ? 'rounded bg-emerald-500/10 px-2' : ''
                }`}
              >
                <span className={`w-8 text-right font-mono ${i < 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}>
                  {i + 1}
                </span>
                <span className={`flex-1 truncate ${isMe ? 'font-semibold text-emerald-300' : 'text-zinc-800 dark:text-zinc-200'}`}>
                  {e.username ?? 'anonymous'}
                </span>
                <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {Number(e.wpm).toFixed(0)}
                  <span className="ml-1 text-xs font-normal text-zinc-500">wpm</span>
                </span>
                <span className="w-16 text-right text-sm text-zinc-500 dark:text-zinc-400">
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
