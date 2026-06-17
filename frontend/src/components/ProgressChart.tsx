// WPM trend over calendar days for the profile. Same hand-rolled-SVG approach as
// WpmChart (no chart lib), but plain static paths — Framer Motion is reserved for
// the results screen + leaderboard, and this lives on the profile.

export interface WpmDay {
  day: string // 'YYYY-MM-DD'
  avgWpm: number
  bestWpm: number
}

const VIEW_W = 600
const VIEW_H = 200
const PAD = { top: 16, right: 16, bottom: 28, left: 36 }
const PLOT_W = VIEW_W - PAD.left - PAD.right
const PLOT_H = VIEW_H - PAD.top - PAD.bottom

function niceMax(value: number): number {
  return Math.max(20, Math.ceil(value / 20) * 20)
}

const shortDay = (iso: string) => iso.slice(5) // 'MM-DD'

export function ProgressChart({ series }: { series: WpmDay[] }) {
  if (series.length === 0) {
    return (
      <p className="text-sm text-muted">
        No history yet — finish a few tests and your trend appears here.
      </p>
    )
  }

  const maxWpm = niceMax(Math.max(...series.map((d) => d.bestWpm)))
  const n = series.length
  const x = (i: number) => PAD.left + (n <= 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W)
  const y = (wpm: number) => PAD.top + PLOT_H - (wpm / maxWpm) * PLOT_H

  const toPath = (key: 'avgWpm' | 'bestWpm') =>
    series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d[key])}`).join(' ')

  const yTicks = [0, maxWpm / 2, maxWpm]

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="WPM over time"
    >
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={VIEW_W - PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            className="text-border"
            stroke="currentColor"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 6}
            y={y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-current text-muted"
            fontSize={11}
          >
            {Math.round(tick)}
          </text>
        </g>
      ))}

      <text x={PAD.left} y={VIEW_H - 8} textAnchor="start" className="fill-current text-muted" fontSize={11}>
        {shortDay(series[0]!.day)}
      </text>
      {n > 1 && (
        <text
          x={VIEW_W - PAD.right}
          y={VIEW_H - 8}
          textAnchor="end"
          className="fill-current text-muted"
          fontSize={11}
        >
          {shortDay(series[n - 1]!.day)}
        </text>
      )}

      {/* Average WPM — fainter */}
      <path
        d={toPath('avgWpm')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-faint"
      />

      {/* Best WPM — accent */}
      <path
        d={toPath('bestWpm')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-accent"
      />

      {/* Best-WPM points for single-day / sparse series legibility */}
      {series.map((d, i) => (
        <circle key={d.day} cx={x(i)} cy={y(d.bestWpm)} r={n > 60 ? 0 : 2} className="fill-current text-accent" />
      ))}
    </svg>
  )
}
