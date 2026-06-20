import type { Trace } from '../lib/api'
import { perKeyAccuracy } from '../lib/replay'
import { Tooltip } from './ui/Tooltip'

/** Per-key accuracy heatmap from a trace (§27): green = accurate, red = missed. */
export function KeyHeatmap({ trace }: { trace: Trace }) {
  const acc = perKeyAccuracy(trace)
  const keys = Object.keys(acc).sort()
  if (keys.length === 0) return null

  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {keys.map((k) => {
        const { correct, total } = acc[k]!
        const ratio = total > 0 ? correct / total : 1
        // hue 0 (red) → 130 (green)
        const hue = Math.round(ratio * 130)
        return (
          <Tooltip key={k} label={`${k} — ${Math.round(ratio * 100)}% (${correct}/${total})`}>
            <span
              className="flex h-9 w-9 flex-col items-center justify-center rounded-md text-sm font-semibold text-zinc-900"
              style={{ background: `hsl(${hue} 70% 60%)` }}
            >
              <span>{k}</span>
              <span className="text-[8px] opacity-80">{Math.round(ratio * 100)}</span>
            </span>
          </Tooltip>
        )
      })}
    </div>
  )
}
