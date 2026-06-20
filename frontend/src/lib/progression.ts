// XP/level curve (§16) — mirrors backend/src/progression.ts. Cumulative XP to
// *reach* a level: 50·L·(L−1). Pure + unit-testable.

export function xpForLevel(level: number): number {
  return 50 * level * (level - 1)
}

export function levelForXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level += 1
  return level
}

/** Level + the XP bounds of the current level, for a progress bar. */
export function levelBounds(xp: number): {
  level: number
  levelXp: number
  nextLevelXp: number
  /** 0–1 progress through the current level. */
  progress: number
} {
  const level = levelForXp(xp)
  const levelXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  const span = nextLevelXp - levelXp
  return { level, levelXp, nextLevelXp, progress: span > 0 ? (xp - levelXp) / span : 0 }
}
