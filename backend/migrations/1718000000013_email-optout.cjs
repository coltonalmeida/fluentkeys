/** Email re-engagement opt-out (§10). Users default to opted-in; the tokenized
 *  unsubscribe link flips this. The job runner skips opted-out users.
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumns("users", {
    email_opt_out: { type: "boolean", notNull: true, default: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns("users", ["email_opt_out"]);
};
