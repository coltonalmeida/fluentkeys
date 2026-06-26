import { Link } from 'react-router-dom'
import { useRivals } from '../hooks/useRivals'

/** "Following" card on the signed-in user's profile: the people you follow, plus
 *  an add-by-username search. Shares useRivals with the leaderboard Friends tab. */
export function FriendsCard() {
  const { follows, query, results, error, runSearch, addRival, removeRival } = useRivals()

  return (
    <section className="flex flex-col gap-4 rounded-lg bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Following</h2>

      {error && <p className="text-sm text-error">{error}</p>}

      {/* Add a rival */}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Add a rival by username…"
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-fg"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
            {results.map((u) => {
              const already = follows.some((f) => f.id === u.id)
              return (
                <li key={u.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span className="truncate text-fg">{u.username}</span>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => addRival(u)}
                    className="text-xs text-accent disabled:text-faint"
                  >
                    {already ? 'Following' : 'Follow'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Following list */}
      {follows.length === 0 ? (
        <p className="text-sm text-muted">You're not following anyone yet.</p>
      ) : (
        <ul className="flex flex-col">
          {follows.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between border-t border-border py-2 first:border-t-0"
            >
              {f.username ? (
                <Link
                  to={`/u/${encodeURIComponent(f.username)}`}
                  className="truncate text-sm text-fg hover:underline"
                >
                  {f.username}
                </Link>
              ) : (
                <span className="truncate text-sm text-muted">anonymous</span>
              )}
              <button
                type="button"
                onClick={() => removeRival(f)}
                className="text-xs text-muted hover:text-error"
              >
                Unfollow
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
