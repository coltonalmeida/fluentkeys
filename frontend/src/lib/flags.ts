/** Global-scope leaderboards (the site-wide board and the daily board) are behind
 *  a flag. Off by default; set VITE_ENABLE_GLOBAL_LEADERBOARD=true to restore them.
 *  The friends-only leaderboard is unaffected. */
export const GLOBAL_LEADERBOARD_ENABLED =
  import.meta.env.VITE_ENABLE_GLOBAL_LEADERBOARD === 'true'
