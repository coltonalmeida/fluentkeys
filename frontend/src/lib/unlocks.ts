// Letter unlock progression — pure, unit-testable.
//
// Deviation from typing-training-spec.md §3.2 (intentional, agreed with the
// product owner): the spec starts with only F + J unlocked, which can form zero
// real English words. We instead start with the whole HOME ROW unlocked so real
// words exist from the very first keystroke, then expand outward by English
// letter frequency. The "introduce → weight toward weakness → unlock through
// proof" engine is unchanged.

import { clamp } from './letterStrength'

export const UNLOCK_ORDER: readonly string[] = [
  // Starter set: the full home row (real words immediately).
  'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l',
  // Then by frequency, working outward from home.
  'e', 't', 'o', 'i', 'n', 'r', 'u', 'c', 'm', 'p', 'w', 'b', 'y', 'v', 'x', 'q', 'z',
]

/** Letters unlocked on day one (the home row). */
export const STARTER_COUNT = 9

// A letter is competent at ≥85 strength with ≥50 samples (a full clean window).
// Raised from the spec's 75/30 — unlocks were coming too fast and shrugging off
// mistakes; this makes the user prove sustained, accurate, quick typing first.
export const UNLOCK_THRESHOLD = 85
export const MIN_SAMPLES_TO_UNLOCK = 50

/** Total letters in the progression. */
export const TOTAL_LETTERS = UNLOCK_ORDER.length

/** The letters currently unlocked, given how many have been unlocked so far. */
export function unlockedLetters(unlockedCount: number): string[] {
  const n = clamp(unlockedCount, STARTER_COUNT, TOTAL_LETTERS)
  return UNLOCK_ORDER.slice(0, n)
}

/** The most recently unlocked letter (null if still on the starter set). */
export function newestLetter(unlockedCount: number): string | null {
  if (unlockedCount <= STARTER_COUNT || unlockedCount > TOTAL_LETTERS) return null
  return UNLOCK_ORDER[unlockedCount - 1] ?? null
}

/** The weakest unlocked letter by strength (the one that gates the next unlock). */
export function weakestUnlocked(
  unlockedCount: number,
  strength: Record<string, number>,
): string {
  const letters = unlockedLetters(unlockedCount)
  let weakest = letters[0]!
  for (const letter of letters) {
    if ((strength[letter] ?? 0) < (strength[weakest] ?? 0)) weakest = letter
  }
  return weakest
}

/**
 * Whether the user has earned the next letter: the weakest unlocked letter must
 * be competent (≥85 strength AND ≥50 samples). Returns false once everything is
 * unlocked.
 */
export function canUnlockNext(
  unlockedCount: number,
  strength: Record<string, number>,
  sampleCounts: Record<string, number>,
): boolean {
  if (unlockedCount >= TOTAL_LETTERS) return false
  const weakest = weakestUnlocked(unlockedCount, strength)
  return (
    (strength[weakest] ?? 0) >= UNLOCK_THRESHOLD &&
    (sampleCounts[weakest] ?? 0) >= MIN_SAMPLES_TO_UNLOCK
  )
}
