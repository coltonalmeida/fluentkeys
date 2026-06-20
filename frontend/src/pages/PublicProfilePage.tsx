import { useAuth, useUser } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AchievementsGrid } from '../components/AchievementsGrid'
import { ActivityHeatmap } from '../components/ActivityHeatmap'
import { follow, getFollows, getPublicProfile, unfollow, type PublicProfile } from '../lib/api'
import { COSMETICS_BY_ID } from '../lib/cosmetics'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from '../lib/words'

const keySetLabel = (id: string) => KEY_SETS[id as KeySetId]?.label ?? id
const difficultyLabel = (id: string) => DIFFICULTIES[id as Difficulty]?.label ?? id

/** Read-only public profile at /u/:username (§2). Anyone can view; no auth. */
export function PublicProfilePage() {
  const { username = '' } = useParams()
  const { isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading')
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to the loading state when the username param changes
    setStatus('loading')
    getPublicProfile(username)
      .then((p) => {
        if (cancelled) return
        setProfile(p)
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('notfound'))
    return () => {
      cancelled = true
    }
  }, [username])

  // Reflect whether the signed-in user already follows this profile.
  useEffect(() => {
    if (!isSignedIn || !profile) return
    let cancelled = false
    getToken()
      .then((t) => getFollows(t))
      .then((r) => !cancelled && setFollowing(r.follows.some((f) => f.id === profile.id)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isSignedIn, getToken, profile])

  const isSelf =
    !!user?.username && !!profile && user.username.toLowerCase() === profile.username.toLowerCase()

  const toggleFollow = () => {
    if (!profile || busy) return
    setBusy(true)
    getToken()
      .then((t) => (following ? unfollow(t, profile.id) : follow(t, profile.id)))
      .then(() => setFollowing((v) => !v))
      .catch(() => {})
      .finally(() => setBusy(false))
  }

  if (status === 'loading') return <p className="text-sm text-muted">Loading profile…</p>
  if (status === 'notfound' || !profile) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">No player found with that username.</p>
        <Link to="/leaderboard" className="text-sm text-accent underline">
          Back to the leaderboard
        </Link>
      </div>
    )
  }

  const frame = profile.frame ? COSMETICS_BY_ID.get(profile.frame) : null
  const badge = profile.badge ? COSMETICS_BY_ID.get(profile.badge) : null

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface p-6">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-contrast ${
              frame ? 'ring-2 ring-offset-2 ring-offset-surface ring-accent' : ''
            }`}
            title={frame ? `${frame.label} frame` : undefined}
          >
            {profile.username.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-fg">{profile.username}</h1>
              {badge && (
                <span title={badge.label} aria-label={badge.label} className="text-2xl">
                  {badge.icon}
                </span>
              )}
            </div>
            <div className="text-xs text-muted">
              Level {profile.level} · Joined {new Date(profile.joinedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-2xl font-bold text-accent">{Math.round(profile.topWpm)}</div>
            <div className="text-xs text-muted">top wpm</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-fg">{profile.totalTests}</div>
            <div className="text-xs text-muted">tests</div>
          </div>
          {isSignedIn && !isSelf && (
            <button
              type="button"
              onClick={toggleFollow}
              disabled={busy}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                following
                  ? 'border border-border bg-surface text-muted hover:bg-surface-2'
                  : 'bg-accent text-accent-contrast hover:bg-accent/90'
              }`}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </section>

      <ActivityHeatmap years={[]} staticDays={profile.activity} />

      <div className="flex flex-col gap-6 rounded-lg bg-surface p-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Personal bests
          </h2>
          {profile.pbs.length === 0 ? (
            <p className="text-sm text-muted">No personal bests yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {profile.pbs.map((pb) => (
                <div key={`${pb.key_set}-${pb.difficulty}`} className="rounded-md bg-surface-2 px-4 py-3">
                  <div className="text-xs text-muted">
                    {keySetLabel(pb.key_set)} · {difficultyLabel(pb.difficulty)}
                  </div>
                  <div className="text-2xl font-bold text-accent">
                    {Number(pb.wpm).toFixed(0)} <span className="text-sm font-normal">wpm</span>
                  </div>
                  <div className="text-xs text-muted">{Number(pb.accuracy).toFixed(1)}% acc</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Achievements
          </h2>
          <AchievementsGrid earned={profile.achievements} />
        </section>
      </div>
    </div>
  )
}
