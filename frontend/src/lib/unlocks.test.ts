import { describe, expect, it } from 'vitest'
import {
  canUnlockNext,
  newestLetter,
  STARTER_COUNT,
  TOTAL_LETTERS,
  UNLOCK_ORDER,
  unlockedLetters,
  weakestUnlocked,
} from './unlocks'

const HOME_ROW = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l']

/** All home-row letters strong, with plenty of samples. */
const strongHomeRow = (): Record<string, number> =>
  Object.fromEntries(HOME_ROW.map((l) => [l, 90]))
const manySamples = (): Record<string, number> =>
  Object.fromEntries(HOME_ROW.map((l) => [l, 50]))

describe('unlock order', () => {
  it('starts with the full home row (deviation from spec §3.2)', () => {
    expect(unlockedLetters(STARTER_COUNT)).toEqual(HOME_ROW)
  })

  it('has 26 letters total, no duplicates', () => {
    expect(UNLOCK_ORDER).toHaveLength(TOTAL_LETTERS)
    expect(new Set(UNLOCK_ORDER).size).toBe(26)
  })

  it('introduces E as the first letter after the home row', () => {
    expect(newestLetter(STARTER_COUNT)).toBeNull()
    expect(newestLetter(STARTER_COUNT + 1)).toBe('e')
    expect(unlockedLetters(STARTER_COUNT + 1)).toContain('e')
  })
})

describe('weakestUnlocked', () => {
  it('returns the lowest-strength unlocked letter', () => {
    const strength = { ...strongHomeRow(), d: 30 }
    expect(weakestUnlocked(STARTER_COUNT, strength)).toBe('d')
  })
})

describe('canUnlockNext', () => {
  it('unlocks when the weakest letter is ≥85 with ≥50 samples', () => {
    expect(canUnlockNext(STARTER_COUNT, strongHomeRow(), manySamples())).toBe(true)
  })

  it('does not unlock if the weakest letter is below threshold', () => {
    const strength = { ...strongHomeRow(), g: 80 } // 80 < 85
    expect(canUnlockNext(STARTER_COUNT, strength, manySamples())).toBe(false)
  })

  it('does not unlock without enough samples on the weakest letter', () => {
    // f is the weakest by strength (just meets 85) but is under-sampled → the
    // gate stays closed even though every letter clears the strength threshold.
    const strength = { ...strongHomeRow(), f: 85 }
    const counts = { ...manySamples(), f: 10 }
    expect(canUnlockNext(STARTER_COUNT, strength, counts)).toBe(false)
  })

  it('never unlocks past the full alphabet', () => {
    expect(canUnlockNext(TOTAL_LETTERS, strongHomeRow(), manySamples())).toBe(false)
  })
})
