import { useAuth } from '@clerk/clerk-react'
import { useEffect, useMemo, useState } from 'react'
import {
  getConsistency,
  getHistory,
  getPersonalBests,
  getStatsByHour,
  getStatsOverview,
  getTrace,
  getWeakKeys,
  getWpmSeries,
  type Consistency,
  type HistoryEntry,
  type HourPoint,
  type PersonalBest,
  type StatsOverview,
  type Trace,
  type WpmDayPoint,
} from '../lib/api'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from '../lib/words'
import { AchievementsGrid } from './AchievementsGrid'
import { ActivityHeatmap } from './ActivityHeatmap'
import { ProgressChart } from './ProgressChart'
import { ReplayPlayer } from './ReplayPlayer'
import { StatGrid } from './StatGrid'
import { TroubleKeys } from './TroubleKeys'
import { Tooltip } from './ui/Tooltip'

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
  const [byHour, setByHour] = useState<HourPoint[]>([])
  const [consistency, setConsistency] = useState<Consistency | null>(null)
  const [days, setDays] = useState(90)
  const [series, setSeries] = useState<WpmDayPoint[] | null>(null)
  const [error, setError] = useState(false)
  const [replayTrace, setReplayTrace] = useState<Trace | null>(null)
  const [replayMsg, setReplayMsg] = useState<string | null>(null)

  const openReplay = (resultId: string) => {
    setReplayMsg(null)
    getTrace(resultId)
      .then((r) => setReplayTrace(r.trace))
      .catch(() => setReplayMsg('No replay saved for that test.'))
  }

  useEffect(() => {
    let cancelled = false
    getToken().then((token) =>
      Promise.all([
        getPersonalBests(token),
        getHistory(token),
        getStatsOverview(token, tz),
        getWeakKeys(token),
        getStatsByHour(token, tz),
        getConsistency(token),
      ])
        .then(([pb, h, ov, wk, bh, cs]) => {
          if (cancelled) return
          setBests(pb.personalBests)
          setHistory(h.results)
          setOverview(ov)
          setWeakKeys(wk.weakKeys)
          setByHour(bh.byHour)
          setConsistency(cs)
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
      {/* GitHub-style activity tracker, kept at the top of the profile. */}
      <ActivityHeatmap years={overview.years} />

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

      {/* Deeper analytics (§26): consistency + WPM by time of day. */}
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Consistency</h2>
          <div className="text-5xl font-bold text-accent">
            {consistency?.score != null ? consistency.score : '—'}
          </div>
          <div className="text-xs text-muted">
            {consistency && consistency.sampleSize > 0
              ? `over last ${consistency.sampleSize} tests`
              : 'take a few tests'}
          </div>
          <p className="mt-2 max-w-[13rem] text-center text-[11px] leading-snug text-faint">
            How steady your speed is — 100 means you hit nearly the same WPM every test; lower means it swings more.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            WPM by time of day
          </h2>
          {byHour.length === 0 ? (
            <p className="text-sm text-muted">No data yet — take a few tests.</p>
          ) : (
            <HourChart points={byHour} />
          )}
        </div>
      </div>

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
                  <th className="pb-2 pr-4 text-right">Accuracy</th>
                  <th className="pb-2 text-right"></th>
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
                    <td className="py-1.5 pr-4 text-right">{Number(r.accuracy).toFixed(1)}%</td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => openReplay(r.id)}
                        className="text-xs text-muted underline hover:text-accent"
                      >
                        Replay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {replayMsg && <p className="text-xs text-muted">{replayMsg}</p>}
      </div>

      {replayTrace && (
        <ReplayPlayer trace={replayTrace} onClose={() => setReplayTrace(null)} />
      )}
    </div>
  )
}

/** Average WPM per hour-of-day over a fixed 24-hour axis, so sparse data (even a
 *  single active hour) still reads as a real chart. */
function HourChart({ points }: { points: HourPoint[] }) {
  const byHour = new Map(points.map((p) => [p.hour, p]))
  const max = Math.max(...points.map((p) => p.avgWpm), 1)
  const peak = points.reduce<HourPoint | null>(
    (best, p) => (!best || p.avgWpm > best.avgWpm ? p : best),
    null,
  )
  const hours = Array.from({ length: 24 }, (_, h) => h)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-32 items-end gap-[2px]">
        {hours.map((h) => {
          const p = byHour.get(h)
          return (
            <Tooltip
              key={h}
              className="h-full flex-1 items-end"
              label={p ? `${h}:00 — ${p.avgWpm} wpm (${p.tests} test${p.tests === 1 ? '' : 's'})` : `${h}:00 — no tests`}
            >
              {p ? (
                <span
                  className="block w-full rounded-t bg-accent"
                  style={{ height: `${Math.max(8, (p.avgWpm / max) * 100)}%` }}
                />
              ) : (
                <span className="block h-0.5 w-full rounded bg-surface-2" />
              )}
            </Tooltip>
          )
        })}
      </div>
      <div className="flex gap-[2px] text-[9px] text-faint">
        {hours.map((h) => (
          <div key={h} className="flex-1 text-center">
            {h % 6 === 0 ? h : ''}
          </div>
        ))}
      </div>
      {peak && (
        <div className="text-xs text-muted">
          Peak {peak.avgWpm} WPM around {peak.hour}:00
        </div>
      )}
    </div>
  )
}
