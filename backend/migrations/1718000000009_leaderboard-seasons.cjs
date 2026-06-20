/** Monthly seasons for the leaderboard (§12). season_id is the entry's UTC
 *  calendar month ('YYYY-MM'); a "season" board is just a filter on it, so a new
 *  month starts fresh while past months stay archived — no destructive reset. The
 *  column DEFAULT computes the current month at insert time, so existing insert
 *  paths need no change.
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumns("leaderboard_entries", {
    season_id: { type: "text" },
  });
  // Backfill existing rows from their creation month.
  pgm.sql(
    `UPDATE leaderboard_entries
        SET season_id = to_char((created_at AT TIME ZONE 'UTC'), 'YYYY-MM')
      WHERE season_id IS NULL`,
  );
  pgm.alterColumn("leaderboard_entries", "season_id", {
    notNull: true,
    default: pgm.func(`to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM')`),
  });
  // Season-scoped board sort.
  pgm.createIndex("leaderboard_entries", [
    "season_id",
    "key_set",
    "difficulty",
    { name: "wpm", sort: "DESC" },
  ]);
};

exports.down = (pgm) => {
  pgm.dropIndex("leaderboard_entries", [
    "season_id",
    "key_set",
    "difficulty",
    { name: "wpm", sort: "DESC" },
  ]);
  pgm.dropColumns("leaderboard_entries", ["season_id"]);
};
