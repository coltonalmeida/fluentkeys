import { motion } from 'framer-motion'
import type { WpmSample } from '../lib/stats'

interface WpmChartProps {
  samples: WpmSample[]
}

// Fixed coordinate space; the SVG scales responsively via width="100%".
const VIEW_W = 600
const VIEW_H = 200
const PAD = { top: 16, right: 16, bottom: 28, left: 36 }
const PLOT_W = VIEW_W - PAD.left - PAD.right
const PLOT_H = VIEW_H - PAD.top - PAD.bottom

/** Round a max value up to a friendly axis ceiling (next multiple of 20, min 20). */
function niceMax(value: number): number {
  return Math.max(20, Math.ceil(value / 20) * 20)
}

/**
 * Hand-rolled inline SVG line chart of WPM across a timed test. No chart lib —
 * the app ships only framer-motion + lucide-react (see FEATURE-ROADMAP). The
 * net-WPM line draws in via Framer; allowed here because this is the results
 * screen.
 */
export function WpmChart({ samples }: WpmChartProps) {
  if (samples.length < 2) return null

  const lastT = samples[samples.length - 1].t
  const maxWpm = niceMax(Math.max(...samples.map((s) => Math.max(s.wpm, s.raw))))

  const x = (t: number) => PAD.left + (lastT === 0 ? 0 : (t / lastT) * PLOT_W)
  const y = (wpm: number) => PAD.top + PLOT_H - (wpm / maxWpm) * PLOT_H

  const toPath = (key: 'wpm' | 'raw') =>
    samples.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(s.t)} ${y(s[key])}`).join(' ')

  const wpmPath = toPath('wpm')
  const rawPath = toPath('raw')

  // Horizontal gridlines / y-axis ticks at 0, half, max.
  const yTicks = [0, maxWpm / 2, maxWpm]
  const errorSamples = samples.filter((s) => s.errors > 0)

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="WPM over time"
      className="max-w-xl"
    >
      {/* Gridlines + y labels */}
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

      {/* X-axis labels: start and end seconds */}
      <text
        x={PAD.left}
        y={VIEW_H - 8}
        textAnchor="start"
        className="fill-current text-muted"
        fontSize={11}
      >
        0s
      </text>
      <text
        x={VIEW_W - PAD.right}
        y={VIEW_H - 8}
        textAnchor="end"
        className="fill-current text-muted"
        fontSize={11}
      >
        {lastT}s
      </text>

      {/* Raw WPM — fainter, behind the net line */}
      <path
        d={rawPath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-faint"
      />

      {/* Net WPM — draws in */}
      <motion.path
        d={wpmPath}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-accent"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
      />

      {/* Error markers on seconds where mistakes happened */}
      {errorSamples.map((s) => (
        <line
          key={s.t}
          x1={x(s.t)}
          x2={x(s.t)}
          y1={PAD.top + PLOT_H}
          y2={PAD.top + PLOT_H - 8}
          className="text-error"
          stroke="currentColor"
          strokeWidth={2}
        />
      ))}
    </svg>
  )
}
