/** Unlockable achievements (FEATURE-ROADMAP #5). One row per (user, key) the
 *  first time a milestone is reached; evaluated inside the result/training
 *  transactions and surfaced on the profile.
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("achievements", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    key: { type: "text", notNull: true },
    earned_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("achievements", "achievements_user_key_uniq", {
    unique: ["user_id", "key"],
  });
};

exports.down = (pgm) => {
  pgm.dropTable("achievements");
};
