// Compact "trouble keys" row: the keys a user misses most, sized/colored by miss
// rate. Fed by per-test miss counts (ResultsScreen) or aggregated history
// (profile / StatsPanel). Pure presentational — counts are raw-char keyed.

// Translucent error tints, picked by each key's miss rate relative to the worst.
const TINT = ['bg-error/15', 'bg-error/30', 'bg-error/45', 'bg-error/60', 'bg-error/80']

const glyph = (key: string) => (key === ' ' ? '␣' : key.toUpperCase())

export function TroubleKeys({
  counts,
  limit = 6,
}: {
  counts: Record<string, number>
  limit?: number
}) {
  const entries = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  if (entries.length === 0) {
    return <p className="text-sm text-muted">No trouble keys — clean run!</p>
  }

  const worst = entries[0]![1]

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, n]) => {
        const tint = TINT[Math.min(TINT.length - 1, Math.floor((n / worst) * TINT.length - 1e-9))]
        return (
          <div
            key={key}
            className={`flex items-center gap-2 rounded-md px-2.5 py-1 ${tint}`}
          >
            <span className="font-mono text-sm font-semibold text-fg">{glyph(key)}</span>
            <span className="text-xs tabular-nums text-error">{n}</span>
          </div>
        )
      })}
    </div>
  )
}
