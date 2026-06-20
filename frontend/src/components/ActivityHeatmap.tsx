import { useAuth } from '@clerk/clerk-react'
import { useEffect, useMemo, useState } from 'react'
import { getActivity, type DayActivity } from '../lib/api'
import { CursorHoverCard } from './ui/cursor-hover-card'

interface ActivityHeatmapProps {
  /** Calendar years with activity (from the overview endpoint), newest first. */
  years: number[]
  /** When provided (public profile), render this rolling-year data instead of
   *  fetching the signed-in user's activity. Year tabs are hidden (pass years=[]). */
  staticDays?: DayActivity[]
}

// Intensity ramp (empty → strongest): an accent-opacity scale so busier days
// glow in the active theme's accent (amber in dark, red in light). Empty days
// sit at the elevated surface tone. Shared by the cells and the legend.
const LEVEL_CLASS = [
  'bg-surface-2',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
]

// Faint edge so adjacent cells stay separable in both themes.
const CELL_RING = 'ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]'

function levelFor(count: number): number {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 9) return 3
  return 4
}

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Local YYYY-MM-DD — matches the backend's tz-localized day keys. */
function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatNiceDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface Cell {
  key: string
  date: Date
  /** Outside the logical range (alignment / future padding) — rendered blank. */
  placeholder: boolean
}

/** Build the week columns + month labels for the selected range (layout only). */
function buildGrid(selectedYear: number | null): { weeks: Cell[][]; monthLabels: (string | null)[] } {
  const today = startOfDay(new Date())

  let rangeStart: Date
  let rangeEnd: Date
  if (selectedYear === null) {
    rangeEnd = today
    rangeStart = new Date(today)
    rangeStart.setDate(today.getDate() - 364)
  } else {
    rangeStart = new Date(selectedYear, 0, 1)
    rangeEnd = selectedYear === today.getFullYear() ? today : new Date(selectedYear, 11, 31)
  }

  // Pad out to full Sun–Sat weeks so every column has 7 rows.
  const alignedStart = new Date(rangeStart)
  alignedStart.setDate(rangeStart.getDate() - rangeStart.getDay())
  const buildEnd = new Date(rangeEnd)
  buildEnd.setDate(rangeEnd.getDate() + (6 - rangeEnd.getDay()))

  const startMs = rangeStart.getTime()
  const endMs = rangeEnd.getTime()

  const weeks: Cell[][] = []
  let week: Cell[] = []
  const cur = new Date(alignedStart)
  while (cur <= buildEnd) {
    const t = cur.getTime()
    week.push({
      key: ymd(cur),
      date: new Date(cur),
      placeholder: t < startMs || t > endMs,
    })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
    cur.setDate(cur.getDate() + 1)
  }

  // Label a column when its first in-range day rolls into a new month.
  const monthLabels: (string | null)[] = []
  let prevMonth = -1
  for (const wk of weeks) {
    const rep = wk.find((c) => !c.placeholder) ?? wk[0]!
    const m = rep.date.getMonth()
    if (m !== prevMonth) {
      monthLabels.push(rep.date.toLocaleString('en-US', { month: 'short' }))
      prevMonth = m
    } else {
      monthLabels.push(null)
    }
  }

  return { weeks, monthLabels }
}

function CellTooltip({ entry }: { entry: DayActivity }) {
  const date = formatNiceDate(entry.date)
  if (entry.count === 0) {
    return <div className="text-sm text-muted">No activity on {date}</div>
  }
  const parts: string[] = []
  if (entry.tests) parts.push(`${entry.tests} test${entry.tests === 1 ? '' : 's'}`)
  if (entry.lessons) parts.push(`${entry.lessons} lesson${entry.lessons === 1 ? '' : 's'}`)
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-semibold text-fg">
        {entry.count} session{entry.count === 1 ? '' : 's'} on {date}
      </div>
      <div className="text-xs text-muted">{parts.join(' · ')}</div>
    </div>
  )
}

/**
 * GitHub-style activity heatmap of daily sessions (timed tests + trainer
 * lessons) over the last year, with calendar-year tabs. Cells reuse the
 * practice section's cursor-following popup (CursorHoverCard) and the same
 * hovered/last dual-state so content stays put during the exit fade.
 */
export function ActivityHeatmap({ years, staticDays }: ActivityHeatmapProps) {
  const { getToken } = useAuth()
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  // null = rolling last 12 months; a number = that calendar year.
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [fetchedDays, setFetchedDays] = useState<DayActivity[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (staticDays) return // caller supplied the data; don't fetch
    let cancelled = false
    setFetchedDays(null)
    setError(false)
    getToken().then((token) =>
      getActivity(token, tz, selectedYear ?? undefined)
        .then((res) => !cancelled && setFetchedDays(res.days))
        .catch(() => !cancelled && setError(true)),
    )
    return () => {
      cancelled = true
    }
  }, [getToken, tz, selectedYear, staticDays])

  const days = staticDays ?? fetchedDays

  const { weeks, monthLabels } = useMemo(() => buildGrid(selectedYear), [selectedYear])
  const byDate = useMemo(
    () => new Map((days ?? []).map((d) => [d.date, d] as const)),
    [days],
  )

  const [hovered, setHovered] = useState<string | null>(null)
  // Keep the last hovered cell so its content stays put during the exit fade.
  const [lastKey, setLastKey] = useState<string | null>(null)
  const enter = (key: string) => {
    setHovered(key)
    setLastKey(key)
  }
  const leave = (key: string) => setHovered((h) => (h === key ? null : h))

  const total = days?.reduce((sum, d) => sum + d.count, 0) ?? 0
  const shown: DayActivity | null = lastKey
    ? byDate.get(lastKey) ?? { date: lastKey, tests: 0, lessons: 0, count: 0 }
    : null

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted">
          {total} session{total === 1 ? '' : 's'}{' '}
          {selectedYear === null ? 'in the last year' : `in ${selectedYear}`}
        </h2>
        {years.length > 0 && (
          <div className="flex gap-1">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                title={selectedYear === y ? 'Back to the last year' : `Show ${y}`}
                onClick={() => setSelectedYear((prev) => (prev === y ? null : y))}
                className={
                  selectedYear === y
                    ? 'rounded px-2 py-0.5 text-xs font-semibold text-accent-contrast bg-accent'
                    : 'rounded px-2 py-0.5 text-xs text-muted hover:bg-surface-2'
                }
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </header>

      {error ? (
        <p className="text-sm text-error">Could not load your activity.</p>
      ) : (
        <div className="flex gap-2">
          <div className="flex flex-col gap-[3px] pr-1 text-[9px] leading-[11px] text-muted">
            <div className="h-[15px]" />
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i} className="h-[11px]">
                {label}
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <div className="flex flex-col gap-[3px]">
              <div className="flex h-[15px] gap-[3px] text-[10px] text-muted">
                {monthLabels.map((label, i) => (
                  <div key={i} className="w-[11px] whitespace-nowrap">
                    {label ?? ''}
                  </div>
                ))}
              </div>
              <div className="flex gap-[3px]">
                {weeks.map((wk, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {wk.map((cell) =>
                      cell.placeholder ? (
                        <div key={cell.key} className="h-[11px] w-[11px]" />
                      ) : (
                        <div
                          key={cell.key}
                          onMouseEnter={() => enter(cell.key)}
                          onMouseLeave={() => leave(cell.key)}
                          className={`h-[11px] w-[11px] rounded-[2px] ${CELL_RING} ${LEVEL_CLASS[levelFor(byDate.get(cell.key)?.count ?? 0)]}`}
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="flex items-center gap-1.5 text-[10px] text-muted">
        <span>Less</span>
        {LEVEL_CLASS.map((cls, i) => (
          <span key={i} className={`h-[11px] w-[11px] rounded-[2px] ${CELL_RING} ${cls}`} />
        ))}
        <span>More</span>
      </footer>

      <CursorHoverCard open={hovered !== null}>
        {shown && <CellTooltip entry={shown} />}
      </CursorHoverCard>
    </section>
  )
}
