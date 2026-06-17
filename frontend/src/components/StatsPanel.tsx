import { useAuth } from '@clerk/clerk-react'
import { useEffect, useMemo, useState } from 'react'
import {
  getHistory,
  getPersonalBests,
  getStatsOverview,
  getWeakKeys,
  getWpmSeries,
  type HistoryEntry,
  type PersonalBest,
  type StatsOverview,
  type WpmDayPoint,
} from '../lib/api'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from '../lib/words'
import { AchievementsGrid } from './AchievementsGrid'
import { ActivityHeatmap } from './ActivityHeatmap'
import { ProgressChart } from './ProgressChart'
import { StatGrid } from './StatGrid'
import { TroubleKeys } from './TroubleKeys'

const RANGES: [number, string][] = [
  [30, '30 days'],
  [90, '90 days'],
  [365, '1 year'],
]

const keySetLabel = (id: string) => KEY_SETS[id as KeySetId]?.label ?? id
const difficultyLabel = (id: string) => DIFFICULTIES[id as Difficulty]?.label ?? id

export function StatsPanel() {
  const { getToken } = useAuth()
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const [bests, setBests] = useState<PersonalBest[] | null>(null)
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [overview, setOverview] = useState<StatsOverview | null>(null)
  const [weakKeys, setWeakKeys] = useState<Record<string, number>>({})
  const [days, setDays] = useState(90)
  const [series, setSeries] = useState<WpmDayPoint[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getToken().then((token) =>
      Promise.all([
        getPersonalBests(token),
        getHistory(token),
        getStatsOverview(token, tz),
        getWeakKeys(token),
      ])
        .then(([pb, h, ov, wk]) => {
          if (cancelled) return
          setBests(pb.personalBests)
          setHistory(h.results)
          setOverview(ov)
          setWeakKeys(wk.weakKeys)
        })
        .catch(() => !cancelled && setError(true)),
    )
    return () => {
      cancelled = true
    }
  }, [getToken, tz])

  // WPM trend reloads when the range toggle changes (separate from the one-shot load).
  useEffect(() => {
    let cancelled = false
    getToken().then((token) =>
      getWpmSeries(token, days, tz)
        .then((r) => !cancelled && setSeries(r.series))
        .catch(() => !cancelled && setError(true)),
    )
    return () => {
      cancelled = true
    }
  }, [getToken, tz, days])

  if (error) return <p className="text-sm text-error">Could not load your stats.</p>
  if (!bests || !history || !overview)
    return <p className="text-sm text-muted">Loading stats…</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            WPM over time
          </h2>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-border bg-surface px-2 py-1 text-fg"
          >
            {RANGES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {series === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <ProgressChart series={series} />
        )}
      </div>

      <ActivityHeatmap years={overview.years} />

      <div className="flex flex-col gap-6 rounded-lg bg-surface p-6">
        <StatGrid title="All Time Statistics" bucket={overview.allTime} />
        <StatGrid title="Statistics for Today" bucket={overview.today} />

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Personal bests
          </h2>
          {bests.length === 0 ? (
            <p className="text-sm text-muted">No personal bests yet — finish a test!</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {bests.map((pb) => (
                <div
                  key={`${pb.key_set}-${pb.difficulty}`}
                  className="rounded-md bg-surface-2 px-4 py-3"
                >
                  <div className="text-xs text-muted">
                    {keySetLabel(pb.key_set)} · {difficultyLabel(pb.difficulty)}
                  </div>
                  <div className="text-2xl font-bold text-accent">
                    {Number(pb.wpm).toFixed(0)} <span className="text-sm font-normal">wpm</span>
                  </div>
                  <div className="text-xs text-muted">
                    {Number(pb.accuracy).toFixed(1)}% acc
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Achievements
          </h2>
          <AchievementsGrid />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Weak keys
          </h2>
          {Object.keys(weakKeys).length === 0 ? (
            <p className="text-sm text-muted">No weak keys tracked yet — take a few tests.</p>
          ) : (
            <TroubleKeys counts={weakKeys} limit={10} />
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Recent tests
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted">No tests recorded yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="pb-2 pr-4">When</th>
                  <th className="pb-2 pr-4">Mode</th>
                  <th className="pb-2 pr-4 text-right">WPM</th>
                  <th className="pb-2 text-right">Accuracy</th>
                </tr>
              </thead>
              <tbody className="text-fg">
                {history.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-1.5 pr-4 text-muted">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-4">
                      {keySetLabel(r.key_set)} · {difficultyLabel(r.difficulty)} · {r.duration}s
                    </td>
                    <td className="py-1.5 pr-4 text-right font-semibold text-accent">
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
    </div>
  )
}
