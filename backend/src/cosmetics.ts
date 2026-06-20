// Cosmetics catalog (§15). The backend owns the *unlock rules* (what grants each
// cosmetic); the frontend owns labels/previews and renders the same ids. Default
// cosmetics are implicit — everyone may equip them, so they are not stored in
// user_cosmetics. Only earned cosmetics get a row.

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
  unlock: Unlock
}

// Keep ids stable: they're persisted in user_cosmetics and equipped in prefs.
export const COSMETICS: readonly Cosmetic[] = [
  // Carets
  { id: 'caret-line', kind: 'caret', unlock: { type: 'default' } },
  { id: 'caret-block', kind: 'caret', unlock: { type: 'level', value: 3 } },
  { id: 'caret-underline', kind: 'caret', unlock: { type: 'level', value: 6 } },
  { id: 'caret-rainbow', kind: 'caret', unlock: { type: 'level', value: 12 } },

  // Keyboard skins
  { id: 'kb-default', kind: 'keyboardSkin', unlock: { type: 'default' } },
  { id: 'kb-neon', kind: 'keyboardSkin', unlock: { type: 'level', value: 8 } },
  { id: 'kb-mono', kind: 'keyboardSkin', unlock: { type: 'achievement', value: 'first_100_wpm' } },

  // Earnable themes (beyond the 4 base themes, which are always available)
  { id: 'theme-midnight', kind: 'theme', unlock: { type: 'level', value: 5 } },
  { id: 'theme-sunset', kind: 'theme', unlock: { type: 'level', value: 10 } },

  // Profile frames
  { id: 'frame-bronze', kind: 'frame', unlock: { type: 'level', value: 5 } },
  { id: 'frame-silver', kind: 'frame', unlock: { type: 'level', value: 10 } },
  { id: 'frame-gold', kind: 'frame', unlock: { type: 'level', value: 20 } },

  // Profile badges
  { id: 'badge-streak-7', kind: 'badge', unlock: { type: 'streak', value: 7 } },
  { id: 'badge-streak-30', kind: 'badge', unlock: { type: 'streak', value: 30 } },
  { id: 'badge-100wpm', kind: 'badge', unlock: { type: 'achievement', value: 'first_100_wpm' } },
  { id: 'badge-all-letters', kind: 'badge', unlock: { type: 'achievement', value: 'all_letters' } },
  { id: 'badge-referrer', kind: 'badge', unlock: { type: 'referral' } },
]

export interface UnlockMetrics {
  level: number
  longestStreak: number
  achievements: ReadonlySet<string>
  /** Has at least one successful referral (grants the referrer badge). */
  referred: boolean
}

/** All non-default cosmetic ids the given metrics unlock (for grantCosmetics). */
export function unlockedCosmeticIds(m: UnlockMetrics): string[] {
  const ids: string[] = []
  for (const c of COSMETICS) {
    switch (c.unlock.type) {
      case 'level':
        if (m.level >= c.unlock.value) ids.push(c.id)
        break
      case 'streak':
        if (m.longestStreak >= c.unlock.value) ids.push(c.id)
        break
      case 'achievement':
        if (m.achievements.has(c.unlock.value)) ids.push(c.id)
        break
      case 'referral':
        if (m.referred) ids.push(c.id)
        break
      // 'default' cosmetics are implicit — never stored.
    }
  }
  return ids
}
