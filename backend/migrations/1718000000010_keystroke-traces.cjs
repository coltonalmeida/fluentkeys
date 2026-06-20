/** Per-keystroke traces for replay + heatmaps (§27) and the duel ghost (§3). One
 *  row per result; `trace` holds the target text + a length-capped event list
 *  ({t, ch, ok}). Stored opaquely as JSONB and bounded by the API.
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("keystroke_traces", {
    result_id: {
      type: "bigint",
      notNull: true,
      primaryKey: true,
      references: "results",
      onDelete: "CASCADE",
    },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    trace: { type: "jsonb", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("keystroke_traces");
};
