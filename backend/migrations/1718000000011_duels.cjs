/** Async "ghost" duels (§3). A creator shares a short code; the challenger types
 *  the exact same words and races the creator's stored keystroke trace. The target
 *  text is stored directly (not regenerated) so any finished test can become a duel.
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("duels", {
    code: { type: "text", primaryKey: true },
    creator_user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    target: { type: "text", notNull: true },
    duration: { type: "integer", notNull: true },
    creator_wpm: { type: "numeric(6,2)", notNull: true },
    creator_accuracy: { type: "numeric(5,2)", notNull: true },
    // The creator's keystroke event list ({t, ch, ok}) — drives the ghost.
    creator_trace: { type: "jsonb", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("duels", "creator_user_id");
};

exports.down = (pgm) => {
  pgm.dropTable("duels");
};
