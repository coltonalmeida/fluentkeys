/** Referral / invite loop (§4). Each user has one shareable code; a new user can
 *  redeem exactly one code, which links them to a referrer and rewards both. The
 *  unique referred_user_id enforces one redemption per user.
 *  @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("referrals", {
    user_id: {
      type: "bigint",
      notNull: true,
      primaryKey: true,
      references: "users",
      onDelete: "CASCADE",
    },
    code: { type: "text", notNull: true, unique: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("referral_redemptions", {
    referred_user_id: {
      type: "bigint",
      notNull: true,
      primaryKey: true,
      references: "users",
      onDelete: "CASCADE",
    },
    referrer_user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    code: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("referral_redemptions", "referrer_user_id");
};

exports.down = (pgm) => {
  pgm.dropTable("referral_redemptions");
  pgm.dropTable("referrals");
};
