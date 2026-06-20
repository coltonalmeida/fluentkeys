import { useProgression } from '../hooks/useProgression'
import { levelBounds } from '../lib/progression'
import { Tooltip } from './ui/Tooltip'

/** Compact header badge: current level + a thin XP progress bar. */
export function LevelBadge() {
  const { progression } = useProgression()
  if (!progression) return null
  const { level, progress, nextLevelXp } = levelBounds(progression.xp)
  return (
    <Tooltip
      label={`Level ${level} · ${progression.xp} XP · ${Math.max(0, nextLevelXp - progression.xp)} to next`}
      side="bottom"
    >
      <span className="flex flex-col items-center" aria-label={`Level ${level}`}>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-accent">
          Lv {level}
        </span>
        <span className="mt-0.5 block h-0.5 w-9 overflow-hidden rounded-full bg-border">
          <span
            className="block h-full bg-accent"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </span>
      </span>
    </Tooltip>
  )
}
