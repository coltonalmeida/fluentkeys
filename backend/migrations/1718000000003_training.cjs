/** Letter-strength trainer persistence (typing-training-spec.md §7).
 *
 *  - training_profiles: one row per user, how far they've unlocked.
 *  - letter_strengths:  one row per (user, letter) — the rolling sample window
 *                       plus a derived score, for cross-device continuity.
 *  - training_sessions: a summary row per completed session.
 *
 *  localStorage remains the client's always-available store; these tables mirror
 *  it for signed-in users (same pattern as the preferences sync).
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("training_profiles", {
    id: { type: "bigserial", primaryKey: true },
    user_id: {
      type: "bigint",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
      unique: true,
    },
    // Index into the unlock-order array; starts at the home row (9 letters).
    unlocked_up_to_index: { type: "integer", notNull: true, default: 9 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("letter_strengths", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    letter: { type: "char(1)", notNull: true },
    strength_score: { type: "numeric(5,2)", notNull: true, default: 0 },
    sample_count: { type: "integer", notNull: true, default: 0 },
    last_practiced_at: { type: "timestamptz" },
    // Serialized rolling window of the last ≤50 KeyEvents (the source of truth).
    recent_samples: { type: "jsonb", notNull: true, default: pgm.func("'[]'::jsonb") },
  });
  pgm.addConstraint("letter_strengths", "letter_strengths_user_letter_uniq", {
    unique: ["user_id", "letter"],
  });

  pgm.createTable("training_sessions", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    started_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    ended_at: { type: "timestamptz" },
    words_typed: { type: "integer", notNull: true, default: 0 },
    peak_wpm: { type: "integer", notNull: true, default: 0 },
    avg_accuracy: { type: "numeric(5,2)", notNull: true, default: 0 },
    unlock_events: { type: "jsonb", notNull: true, default: pgm.func("'[]'::jsonb") },
  });
  pgm.createIndex("training_sessions", ["user_id", { name: "started_at", sort: "DESC" }]);
};

exports.down = (pgm) => {
  pgm.dropTable("training_sessions");
  pgm.dropTable("letter_strengths");
  pgm.dropTable("training_profiles");
};
