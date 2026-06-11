/** Switch users to Clerk-managed identity: no local passwords. */
exports.up = (pgm) => {
  // Dev-only test rows used the old password scheme; remove them.
  pgm.sql('DELETE FROM users');
  pgm.dropColumns('users', ['password_hash']);
  pgm.addColumns('users', {
    clerk_id: { type: 'text', notNull: true, unique: true },
  });
  // Clerk owns identity; email/username are cached copies and may lag.
  pgm.alterColumn('users', 'email', { notNull: false });
  pgm.alterColumn('users', 'username', { notNull: false });
};

exports.down = (pgm) => {
  pgm.sql('DELETE FROM users');
  pgm.dropColumns('users', ['clerk_id']);
  pgm.addColumns('users', {
    password_hash: { type: 'text', notNull: true },
  });
  pgm.alterColumn('users', 'email', { notNull: true });
  pgm.alterColumn('users', 'username', { notNull: true });
};
