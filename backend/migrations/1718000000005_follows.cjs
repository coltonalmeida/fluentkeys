/** Follows graph for the friends/rivals leaderboard (FEATURE-ROADMAP #10).
 *  follower_id follows followee_id; the friends-scoped leaderboard restricts to a
 *  user's followees plus self.
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("follows", {
    follower_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    followee_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("follows", "follows_pkey", {
    primaryKey: ["follower_id", "followee_id"],
  });
  // Reverse lookups (who follows me) and the leaderboard's followee filter.
  pgm.createIndex("follows", "followee_id");
};

exports.down = (pgm) => {
  pgm.dropTable("follows");
};
