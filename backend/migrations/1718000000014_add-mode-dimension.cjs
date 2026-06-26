/** Adds a `mode` dimension (words/punctuation/numbers/quotes/code) so the
 *  leaderboard and personal bests are separated per mode — Code runs (slower)
 *  no longer compete against Words runs. Existing rows predate mode tracking and
 *  are backfilled to 'words' (the dominant historical mode), mirroring the
 *  add-column→backfill→notNull pattern from the leaderboard-seasons migration.
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  // mode is added NOT NULL DEFAULT 'words': Postgres backfills existing rows to
  // 'words' in one step, and the default keeps the previous backend (which omits
  // mode on INSERT) working through the redeploy window. New code always supplies
  // mode explicitly; the default is just a safety net.

  // --- test_sessions: source of truth for a result's mode ---
  pgm.addColumns("test_sessions", {
    mode: { type: "text", notNull: true, default: "words" },
  });

  // --- personal_bests: a PB is now per (user, key_set, difficulty, mode) ---
  pgm.addColumns("personal_bests", {
    mode: { type: "text", notNull: true, default: "words" },
  });
  pgm.dropConstraint("personal_bests", "personal_bests_user_keyset_difficulty_uniq");
  pgm.addConstraint("personal_bests", "personal_bests_user_keyset_difficulty_mode_uniq", {
    unique: ["user_id", "key_set", "difficulty", "mode"],
  });

  // --- leaderboard_entries: mode joins the sort keys ---
  pgm.addColumns("leaderboard_entries", {
    mode: { type: "text", notNull: true, default: "words" },
  });
  // Replace both sort indexes with mode-inclusive versions (mode after difficulty).
  pgm.dropIndex("leaderboard_entries", [
    "key_set",
    "difficulty",
    { name: "wpm", sort: "DESC" },
    { name: "created_at", sort: "DESC" },
  ]);
  pgm.dropIndex("leaderboard_entries", [
    "season_id",
    "key_set",
    "difficulty",
    { name: "wpm", sort: "DESC" },
  ]);
  pgm.createIndex("leaderboard_entries", [
    "key_set",
    "difficulty",
    "mode",
    { name: "wpm", sort: "DESC" },
    { name: "created_at", sort: "DESC" },
  ]);
  pgm.createIndex("leaderboard_entries", [
    "season_id",
    "key_set",
    "difficulty",
    "mode",
    { name: "wpm", sort: "DESC" },
  ]);
};

exports.down = (pgm) => {
  // leaderboard_entries: restore the original (mode-less) indexes.
  pgm.dropIndex("leaderboard_entries", [
    "key_set",
    "difficulty",
    "mode",
    { name: "wpm", sort: "DESC" },
    { name: "created_at", sort: "DESC" },
  ]);
  pgm.dropIndex("leaderboard_entries", [
    "season_id",
    "key_set",
    "difficulty",
    "mode",
    { name: "wpm", sort: "DESC" },
  ]);
  pgm.createIndex("leaderboard_entries", [
    "key_set",
    "difficulty",
    { name: "wpm", sort: "DESC" },
    { name: "created_at", sort: "DESC" },
  ]);
  pgm.createIndex("leaderboard_entries", [
    "season_id",
    "key_set",
    "difficulty",
    { name: "wpm", sort: "DESC" },
  ]);
  pgm.dropColumns("leaderboard_entries", ["mode"]);

  // personal_bests: restore the original unique constraint.
  pgm.dropConstraint("personal_bests", "personal_bests_user_keyset_difficulty_mode_uniq");
  pgm.addConstraint("personal_bests", "personal_bests_user_keyset_difficulty_uniq", {
    unique: ["user_id", "key_set", "difficulty"],
  });
  pgm.dropColumns("personal_bests", ["mode"]);

  pgm.dropColumns("test_sessions", ["mode"]);
};
