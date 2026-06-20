import { usePreferences } from '../hooks/usePreferences'
import { useProgression } from '../hooks/useProgression'
import { COSMETICS_BY_ID } from '../lib/cosmetics'
import { levelBounds } from '../lib/progression'

/** Profile summary of XP/level, the XP progress bar, streak freezes, and the
 *  equipped badge/frame (§15/§16/§11). */
export function ProgressionCard() {
  const { progression } = useProgression()
  const { prefs } = usePreferences()
  if (!progression) return null

  const { level, levelXp, nextLevelXp, progress } = levelBounds(progression.xp)
  const badge = prefs.equippedCosmetics.badge
    ? COSMETICS_BY_ID.get(prefs.equippedCosmetics.badge)
    : null

  return (
    <section className="rounded-xl bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-bold text-accent-contrast">
            {level}
          </div>
          <div>
            <div className="text-sm font-semibold text-fg">Level {level}</div>
            <div className="text-xs text-muted">{progression.xp.toLocaleString()} XP</div>
          </div>
          {badge && (
            <span title={badge.label} className="ml-1 text-2xl" aria-label={badge.label}>
              {badge.icon}
            </span>
          )}
        </div>
        {progression.streakFreezes > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-muted" title="Streak freezes protect a missed day">
            <span className="text-lg">🧊</span>
            {progression.streakFreezes} freeze{progression.streakFreezes === 1 ? '' : 's'}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-faint">
          <span>{(progression.xp - levelXp).toLocaleString()} XP this level</span>
          <span>{(nextLevelXp - progression.xp).toLocaleString()} XP to level {level + 1}</span>
        </div>
      </div>
    </section>
  )
}
