/** Progression spine: XP/levels (§16), an owned-cosmetics store (§15), and
 *  streak-freeze tokens (§11). `user_progression` is one row per user, upserted
 *  inside the result/training transactions alongside achievements;
 *  `user_cosmetics` records each earned cosmetic (defaults are implicit on the
 *  client). frozen_days holds tz-local 'YYYY-MM-DD' dates a freeze has bridged so
 *  the streak calc treats them as active.
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("user_progression", {
    user_id: {
      type: "bigint",
      notNull: true,
      primaryKey: true,
      references: "users",
      onDelete: "CASCADE",
    },
    xp: { type: "bigint", notNull: true, default: 0 },
    level: { type: "integer", notNull: true, default: 1 },
    streak_freezes: { type: "integer", notNull: true, default: 0 },
    // Highest 7-day streak milestone already rewarded, so freezes grant once.
    freeze_milestone: { type: "integer", notNull: true, default: 0 },
    frozen_days: { type: "jsonb", notNull: true, default: "[]" },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("user_cosmetics", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    cosmetic_id: { type: "text", notNull: true },
    acquired_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("user_cosmetics", "user_cosmetics_user_cosmetic_uniq", {
    unique: ["user_id", "cosmetic_id"],
  });
};

exports.down = (pgm) => {
  pgm.dropTable("user_cosmetics");
  pgm.dropTable("user_progression");
};
