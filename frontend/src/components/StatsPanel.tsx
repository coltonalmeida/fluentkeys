import { useAuth } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import {
  getHistory,
  getPersonalBests,
  type HistoryEntry,
  type PersonalBest,
} from '../lib/api'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from '../lib/words'

const keySetLabel = (id: string) => KEY_SETS[id as KeySetId]?.label ?? id
const difficultyLabel = (id: string) => DIFFICULTIES[id as Difficulty]?.label ?? id

export function StatsPanel() {
  const { getToken } = useAuth()
  const [bests, setBests] = useState<PersonalBest[] | null>(null)
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getToken().then((token) =>
      Promise.all([getPersonalBests(token), getHistory(token)])
        .then(([pb, h]) => {
          if (cancelled) return
          setBests(pb.personalBests)
          setHistory(h.results)
        })
        .catch(() => !cancelled && setError(true)),
    )
    return () => {
      cancelled = true
    }
  }, [getToken])

  if (error) return <p className="text-sm text-red-400">Could not load your stats.</p>
  if (!bests || !history) return <p className="text-sm text-zinc-500">Loading stats…</p>

  return (
    <div className="flex flex-col gap-6 rounded-lg bg-zinc-800/50 p-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Personal bests
        </h2>
        {bests.length === 0 ? (
          <p className="text-sm text-zinc-500">No personal bests yet — finish a test!</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bests.map((pb) => (
              <div
                key={`${pb.key_set}-${pb.difficulty}`}
                className="rounded-md bg-zinc-900/60 px-4 py-3"
              >
                <div className="text-xs text-zinc-500">
                  {keySetLabel(pb.key_set)} · {difficultyLabel(pb.difficulty)}
                </div>
                <div className="text-2xl font-bold text-emerald-400">
                  {Number(pb.wpm).toFixed(0)} <span className="text-sm font-normal">wpm</span>
                </div>
                <div className="text-xs text-zinc-500">
                  {Number(pb.accuracy).toFixed(1)}% acc
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Recent tests
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">No tests recorded yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr>
                <th className="pb-2 pr-4">When</th>
                <th className="pb-2 pr-4">Mode</th>
                <th className="pb-2 pr-4 text-right">WPM</th>
                <th className="pb-2 text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {history.map((r) => (
                <tr key={r.id} className="border-t border-zinc-700/50">
                  <td className="py-1.5 pr-4 text-zinc-500">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-4">
                    {keySetLabel(r.key_set)} · {difficultyLabel(r.difficulty)} · {r.duration}s
                  </td>
                  <td className="py-1.5 pr-4 text-right font-semibold text-emerald-400">
                    {Number(r.wpm).toFixed(0)}
                  </td>
                  <td className="py-1.5 text-right">{Number(r.accuracy).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
