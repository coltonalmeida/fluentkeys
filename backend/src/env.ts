import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Env lives in the repo root, one level above backend/.
// This module must be imported before anything that reads process.env.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

/** Global-scope leaderboards (the site-wide board and the daily board) are behind
 *  a flag. Off by default; set ENABLE_GLOBAL_LEADERBOARD=true to serve them again.
 *  The friends-scoped leaderboard is unaffected. */
export const GLOBAL_LEADERBOARD_ENABLED =
  process.env.ENABLE_GLOBAL_LEADERBOARD === "true";
