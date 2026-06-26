import { useAuth } from '@clerk/clerk-react'
import { useCallback, useEffect, useState } from 'react'
import { follow, getFollows, searchUsers, unfollow, type UserSummary } from '../lib/api'

const msg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

/**
 * Shared "rivals" (people you follow) state for the leaderboard Friends tab and
 * the profile Following card: the follow list, the add-by-username search, and
 * add/remove. Follow/unfollow are optimistic and revert on failure, and errors
 * surface via `error` instead of being silently swallowed.
 */
export function useRivals() {
  const { getToken, isSignedIn } = useAuth()
  const [follows, setFollows] = useState<UserSummary[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!isSignedIn) return
    getToken()
      .then((t) => getFollows(t))
      .then((r) => setFollows(r.follows))
      .catch((e) => setError(msg(e, 'Could not load who you follow.')))
  }, [getToken, isSignedIn])

  useEffect(() => {
    refresh()
  }, [refresh])

  const runSearch = useCallback(
    (q: string) => {
      setQuery(q)
      if (q.trim().length < 1) {
        setResults([])
        return
      }
      getToken()
        .then((t) => searchUsers(t, q))
        .then((r) => setResults(r.users))
        .catch((e) => {
          setResults([])
          setError(msg(e, 'Search failed.'))
        })
    },
    [getToken],
  )

  const addRival = useCallback(
    (u: UserSummary) => {
      setError(null)
      // Optimistic: show the rival immediately, revert if the follow fails.
      setFollows((prev) => (prev.some((f) => f.id === u.id) ? prev : [...prev, u]))
      setQuery('')
      setResults([])
      getToken()
        .then((t) => follow(t, u.id))
        .catch((e) => {
          setFollows((prev) => prev.filter((f) => f.id !== u.id))
          setError(msg(e, 'Could not follow that user.'))
        })
    },
    [getToken],
  )

  const removeRival = useCallback(
    (u: UserSummary) => {
      setError(null)
      setFollows((prev) => prev.filter((f) => f.id !== u.id)) // optimistic
      getToken()
        .then((t) => unfollow(t, u.id))
        .catch((e) => {
          setFollows((prev) => (prev.some((f) => f.id === u.id) ? prev : [...prev, u])) // revert
          setError(msg(e, 'Could not unfollow that user.'))
        })
    },
    [getToken],
  )

  return {
    follows,
    /** Usernames you follow — for highlighting leaderboard rows (entries carry no id). */
    followUsernames: new Set(follows.map((f) => f.username).filter(Boolean)),
    query,
    results,
    error,
    isSignedIn,
    runSearch,
    addRival,
    removeRival,
    refresh,
  }
}
