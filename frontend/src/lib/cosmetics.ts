// Cosmetics catalog (§15) — presentation layer. Ids + unlock rules mirror
// backend/src/cosmetics.ts; this file adds the labels/previews the UI shows and a
// human-readable unlock description. Default cosmetics are always equippable.

export type CosmeticKind = 'caret' | 'keyboardSkin' | 'badge' | 'frame' | 'theme'

export type Unlock =
  | { type: 'default' }
  | { type: 'level'; value: number }
  | { type: 'achievement'; value: string }
  | { type: 'streak'; value: number }
  | { type: 'referral' }

export interface Cosmetic {
  id: string
  kind: CosmeticKind
  label: string
  /** Short glyph/emoji preview for badges/frames; carets/skins preview inline. */
  icon?: string
  unlock: Unlock
}

export const COSMETICS: readonly Cosmetic[] = [
  // Carets
  { id: 'caret-line', kind: 'caret', label: 'Line', unlock: { type: 'default' } },
  { id: 'caret-block', kind: 'caret', label: 'Block', unlock: { type: 'level', value: 3 } },
  { id: 'caret-underline', kind: 'caret', label: 'Underline', unlock: { type: 'level', value: 6 } },
  { id: 'caret-rainbow', kind: 'caret', label: 'Rainbow', unlock: { type: 'level', value: 12 } },

  // Keyboard skins
  { id: 'kb-default', kind: 'keyboardSkin', label: 'Default', unlock: { type: 'default' } },
  { id: 'kb-neon', kind: 'keyboardSkin', label: 'Neon', unlock: { type: 'level', value: 8 } },
  { id: 'kb-mono', kind: 'keyboardSkin', label: 'Mono', unlock: { type: 'achievement', value: 'first_100_wpm' } },

  // Earnable themes (selected via the theme picker once owned)
  { id: 'theme-midnight', kind: 'theme', label: 'Midnight', unlock: { type: 'level', value: 5 } },
  { id: 'theme-sunset', kind: 'theme', label: 'Sunset', unlock: { type: 'level', value: 10 } },

  // Profile frames
  { id: 'frame-bronze', kind: 'frame', label: 'Bronze', icon: '🥉', unlock: { type: 'level', value: 5 } },
  { id: 'frame-silver', kind: 'frame', label: 'Silver', icon: '🥈', unlock: { type: 'level', value: 10 } },
  { id: 'frame-gold', kind: 'frame', label: 'Gold', icon: '🥇', unlock: { type: 'level', value: 20 } },

  // Profile badges
  { id: 'badge-streak-7', kind: 'badge', label: 'Week Warrior', icon: '🔥', unlock: { type: 'streak', value: 7 } },
  { id: 'badge-streak-30', kind: 'badge', label: 'Unstoppable', icon: '⚡', unlock: { type: 'streak', value: 30 } },
  { id: 'badge-100wpm', kind: 'badge', label: 'Centurion', icon: '💯', unlock: { type: 'achievement', value: 'first_100_wpm' } },
  { id: 'badge-all-letters', kind: 'badge', label: 'Alphabet', icon: '🔤', unlock: { type: 'achievement', value: 'all_letters' } },
  { id: 'badge-referrer', kind: 'badge', label: 'Recruiter', icon: '🤝', unlock: { type: 'referral' } },
]

export const COSMETICS_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]))

/** Theme ids that are cosmetics (gated by ownership in the theme picker). */
export const COSMETIC_THEME_IDS = COSMETICS.filter((c) => c.kind === 'theme').map((c) => c.id)

export function cosmeticsOfKind(kind: CosmeticKind): Cosmetic[] {
  return COSMETICS.filter((c) => c.kind === kind)
}

/** Human-readable unlock requirement, shown on locked cosmetics. */
export function unlockHint(unlock: Unlock): string {
  switch (unlock.type) {
    case 'default':
      return 'Available to everyone'
    case 'level':
      return `Reach level ${unlock.value}`
    case 'streak':
      return `${unlock.value}-day streak`
    case 'achievement':
      return 'Earn an achievement'
    case 'referral':
      return 'Invite a friend'
  }
}

/** A cosmetic is owned if it's a default, or its id is in the owned set. */
export function isOwned(c: Cosmetic, owned: ReadonlySet<string>): boolean {
  return c.unlock.type === 'default' || owned.has(c.id)
}
