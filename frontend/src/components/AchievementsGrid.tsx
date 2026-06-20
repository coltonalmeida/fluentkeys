import { useAuth } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { ACHIEVEMENTS } from '../lib/achievements'
import { getAchievements, type EarnedAchievement } from '../lib/api'

interface AchievementsGridProps {
  /** When provided (e.g. a public profile), render these instead of fetching the
   *  signed-in user's achievements. */
  earned?: EarnedAchievement[]
}

/** Profile grid of all achievements: earned ones lit + dated, locked ones dimmed. */
export function AchievementsGrid({ earned: earnedProp }: AchievementsGridProps = {}) {
  const { getToken } = useAuth()
  const [fetched, setFetched] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (earnedProp) return // caller supplied the data; don't fetch
    let cancelled = false
    getToken().then((token) =>
      getAchievements(token)
        .then((r) => {
          if (cancelled) return
          setFetched(new Map(r.earned.map((e) => [e.key, e.earnedAt])))
        })
        .catch(() => {}),
    )
    return () => {
      cancelled = true
    }
  }, [getToken, earnedProp])

  const earned = earnedProp
    ? new Map(earnedProp.map((e) => [e.key, e.earnedAt]))
    : fetched

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {ACHIEVEMENTS.map((a) => {
        const earnedAt = earned.get(a.key)
        const unlocked = earnedAt != null
        return (
          <div
            key={a.key}
            title={a.description}
            className={`flex flex-col items-center gap-1 rounded-md bg-surface-2 px-3 py-3 text-center ${
              unlocked ? '' : 'opacity-50'
            }`}
          >
            <span className="text-2xl">{a.icon}</span>
            <span className={`text-sm font-semibold ${unlocked ? 'text-accent' : 'text-faint'}`}>
              {a.label}
            </span>
            <span className="text-xs text-muted">{a.description}</span>
            {unlocked && (
              <span className="text-[10px] text-faint">
                {new Date(earnedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
