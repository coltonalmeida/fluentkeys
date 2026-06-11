/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("users", {
    id: { type: "bigserial", primaryKey: true },
    email: { type: "text", notNull: true, unique: true },
    username: { type: "text", notNull: true, unique: true },
    password_hash: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("test_sessions", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", references: "users", onDelete: "SET NULL" },
    key_set: { type: "text", notNull: true },
    difficulty: { type: "text", notNull: true },
    duration: { type: "integer", notNull: true },
    started_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("results", {
    id: { type: "bigserial", primaryKey: true },
    session_id: { type: "bigint", notNull: true, references: "test_sessions", onDelete: "CASCADE" },
    user_id: { type: "bigint", references: "users", onDelete: "SET NULL" },
    wpm: { type: "numeric(6,2)", notNull: true },
    accuracy: { type: "numeric(5,2)", notNull: true },
    raw_wpm: { type: "numeric(6,2)", notNull: true },
    char_counts: { type: "jsonb", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("personal_bests", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    key_set: { type: "text", notNull: true },
    difficulty: { type: "text", notNull: true },
    wpm: { type: "numeric(6,2)", notNull: true },
    accuracy: { type: "numeric(5,2)", notNull: true },
    result_id: { type: "bigint", notNull: true, references: "results", onDelete: "CASCADE" },
    achieved_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("personal_bests", "personal_bests_user_keyset_difficulty_uniq", {
    unique: ["user_id", "key_set", "difficulty"],
  });

  pgm.createTable("leaderboard_entries", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    key_set: { type: "text", notNull: true },
    difficulty: { type: "text", notNull: true },
    wpm: { type: "numeric(6,2)", notNull: true },
    accuracy: { type: "numeric(5,2)", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("leaderboard_entries", [
    "key_set",
    "difficulty",
    { name: "wpm", sort: "DESC" },
    { name: "created_at", sort: "DESC" },
  ]);
};

exports.down = (pgm) => {
  pgm.dropTable("leaderboard_entries");
  pgm.dropTable("personal_bests");
  pgm.dropTable("results");
  pgm.dropTable("test_sessions");
  pgm.dropTable("users");
};
