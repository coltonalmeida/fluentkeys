/** Track when a user last changed their username, to enforce the
 *  once-per-week rename limit. Null means never changed since this shipped
 *  (or an initial mandatory-creation set) — those are exempt from the limit.
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumns("users", {
    username_changed_at: { type: "timestamptz" },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns("users", ["username_changed_at"]);
};
