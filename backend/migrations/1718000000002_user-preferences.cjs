/** Store each user's UI preferences (font, keyboard layout, language, theme).
 *  Nullable: a user only has a row's worth of preferences once they save any;
 *  the frontend treats localStorage as the source of truth and syncs here. */
exports.up = (pgm) => {
  pgm.addColumns('users', {
    preferences: { type: 'jsonb' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['preferences']);
};
