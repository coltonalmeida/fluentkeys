import { useAuth } from '@clerk/clerk-react'
import { Flame } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePreferences } from '../hooks/usePreferences'
import { getStreak, type StreakResponse } from '../lib/api'

/**
 * Header flame + current-streak count for signed-in users, wrapped in a progress
 * ring that fills as today's practice approaches the user's daily goal. Inline
 * SVG ring (stroke-dasharray) — accent arc over a faint track.
 */
export function StreakBadge() {
  const { getToken, isSignedIn } = useAuth()
  const { prefs } = usePreferences()
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const [streak, setStreak] = useState<StreakResponse | null>(null)

  useEffect(() => {
    if (!isSignedIn) return
    let cancelled = false
    getToken().then((token) =>
      getStreak(token, tz)
        .then((s) => !cancelled && setStreak(s))
        .catch(() => {}),
    )
    return () => {
      cancelled = true
    }
  }, [getToken, isSignedIn, tz])

  if (!streak) return null

  const goalSecs = prefs.dailyGoal * 60
  const progress = goalSecs > 0 ? Math.min(1, streak.todaySeconds / goalSecs) : 0
  const met = goalSecs > 0 && progress >= 1
  const R = 11
  const CIRC = 2 * Math.PI * R

  const title =
    `${streak.current}-day streak · longest ${streak.longest}` +
    (goalSecs > 0
      ? ` · ${Math.round(streak.todaySeconds / 60)}/${prefs.dailyGoal} min today`
      : '')

  return (
    <div title={title} className="flex items-center gap-1.5 text-sm">
      <span className="relative inline-flex h-7 w-7 items-center justify-center">
        {goalSecs > 0 && (
          <svg className="absolute inset-0" viewBox="0 0 28 28">
            <circle
              cx="14"
              cy="14"
              r={R}
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              className="text-faint"
            />
            <circle
              cx="14"
              cy="14"
              r={R}
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              className="text-accent"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              strokeLinecap="round"
              transform="rotate(-90 14 14)"
            />
          </svg>
        )}
        <Flame size={14} className={met ? 'text-accent' : 'text-muted'} />
      </span>
      <span className="font-semibold tabular-nums text-fg">{streak.current}</span>
    </div>
  )
}
