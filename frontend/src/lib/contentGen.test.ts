import { describe, expect, it } from 'vitest'
import { eligibleWords, generateLine, generatePseudoword } from './contentGen'

const HOME_ROW = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l']

/** Deterministic PRNG (mulberry32) so generation tests are reproducible. */
function seededRng(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const onlyUses = (word: string, letters: string[]) =>
  [...word].every((ch) => letters.includes(ch))

describe('eligibleWords', () => {
  it('returns only words typeable with the unlocked letters', () => {
    const words = eligibleWords(HOME_ROW)
    expect(words.length).toBeGreaterThan(20) // home row alone yields real words
    expect(words.every((w) => onlyUses(w, HOME_ROW))).toBe(true)
  })

  it('includes known home-row words and excludes off-row words', () => {
    const words = eligibleWords(HOME_ROW)
    expect(words).toContain('salad')
    expect(words).not.toContain('the') // needs t, h(ok), e — t/e are locked
  })
})

describe('generateLine', () => {
  it('produces 16–24 words using only unlocked letters', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const line = generateLine({ unlocked: HOME_ROW, strength: {} }, seededRng(seed))
      const words = line.split(' ')
      expect(words.length).toBeGreaterThanOrEqual(16)
      expect(words.length).toBeLessThanOrEqual(24)
      expect(words.every((w) => onlyUses(w, HOME_ROW))).toBe(true)
    }
  })

  it('keeps lines mostly real — at most 2 distinct made-up words per line', () => {
    const real = new Set(eligibleWords(HOME_ROW))
    for (let seed = 1; seed <= 25; seed++) {
      const words = generateLine({ unlocked: HOME_ROW, strength: {} }, seededRng(seed)).split(' ')
      const pseudo = new Set(words.filter((w) => !real.has(w)))
      expect(pseudo.size).toBeLessThanOrEqual(2)
    }
  })

  it('still exposes letters no real word covers (e.g. j) so progression never stalls', () => {
    // No home-row English word contains "j" — without targeted pseudowords its
    // strength could never rise and the unlock gate would lock forever.
    let sawJ = false
    for (let seed = 1; seed <= 15 && !sawJ; seed++) {
      const line = generateLine({ unlocked: HOME_ROW, strength: {} }, seededRng(seed))
      if (line.includes('j')) sawJ = true
      // every character must still be a typeable home-row letter
      expect(line.split(' ').every((w) => onlyUses(w, HOME_ROW))).toBe(true)
    }
    expect(sawJ).toBe(true)
  })
})

describe('generatePseudoword', () => {
  it('only uses unlocked letters even with a tiny set', () => {
    const unlocked = ['f', 'j', 'a']
    for (let seed = 1; seed <= 25; seed++) {
      const word = generatePseudoword(unlocked, {}, seededRng(seed))
      expect(word.length).toBeGreaterThanOrEqual(2)
      expect(onlyUses(word, unlocked)).toBe(true)
    }
  })
})
