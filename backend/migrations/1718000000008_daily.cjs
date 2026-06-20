/** Daily challenge results (§9). One shared, seeded test per UTC day with its own
 *  leaderboard. One row per (user, date), keeping the user's best WPM that day.
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("daily_results", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    date: { type: "date", notNull: true },
    wpm: { type: "numeric(6,2)", notNull: true },
    accuracy: { type: "numeric(5,2)", notNull: true },
    raw_wpm: { type: "numeric(6,2)", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("daily_results", "daily_results_user_date_uniq", {
    unique: ["user_id", "date"],
  });
  // The per-day leaderboard sorts by wpm desc within a date.
  pgm.createIndex("daily_results", ["date", { name: "wpm", sort: "DESC" }]);
};

exports.down = (pgm) => {
  pgm.dropTable("daily_results");
};
