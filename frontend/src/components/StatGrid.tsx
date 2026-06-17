import type { StatBucket } from '../lib/api'

/** Seconds → HH:MM:SS (hours not capped at 24). */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`
}

const wpm = (v: number | null) => (v === null ? 'N/A' : v.toFixed(0))
const pct = (v: number | null) => (v === null ? 'N/A' : `${v.toFixed(1)}%`)

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-accent">
        {value}
      </div>
    </div>
  )
}

/** A titled grid of the six headline stats, used for both All Time and Today. */
export function StatGrid({ title, bucket }: { title: string; bucket: StatBucket }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Time" value={formatDuration(bucket.timeSeconds)} />
        <Stat label="Lessons" value={String(bucket.lessons)} />
        <Stat label="Top speed" value={wpm(bucket.topWpm)} />
        <Stat label="Average speed" value={wpm(bucket.avgWpm)} />
        <Stat label="Top accuracy" value={pct(bucket.topAccuracy)} />
        <Stat label="Average accuracy" value={pct(bucket.avgAccuracy)} />
      </div>
    </section>
  )
}
