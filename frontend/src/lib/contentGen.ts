// Practice-text generation — pure, unit-testable. Real words first, weighted
// toward the user's weakest unlocked letters; pseudowords supplement when too
// few real words are available (typing-training-spec.md §4).

import { WORD_LIST } from './wordlist'

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])
/** Below this many eligible real words, supplement with pseudowords (§4.1). */
const MIN_REAL_WORDS = 20
const WORDS_PER_LINE_MIN = 16
const WORDS_PER_LINE_MAX = 24
/** Cap made-up words per line so lines read as real English (§4.1). */
const MAX_PSEUDO_PER_LINE = 2
const PSEUDO_TEMPLATES = ['cv', 'cvc', 'cvcc', 'cvcv', 'cvccv'] as const

// Tiny blocklist so generated pseudowords never read as slurs/profanity (§4.3).
const PROFANITY = new Set(['ass', 'fag', 'cum', 'jiz', 'tit', 'sex', 'fuk', 'fck'])

type Rng = () => number

export interface LineOptions {
  /** Currently unlocked letters. */
  unlocked: string[]
  /** Strength 0–100 per letter (drives weakness weighting). */
  strength: Record<string, number>
  /** Most recently unlocked letter; words with it get 2× weight while boosting. */
  newestLetter?: string | null
  /** Whether the 2× newest-letter boost is active (first 2 sessions after unlock). */
  boostNewest?: boolean
  /** Precomputed eligible real words (perf); derived from `unlocked` if omitted. */
  eligible?: string[]
  /** Phase 7 (§25): per-key miss counts from the user's timed-test history. Adds a
   *  bounded boost so the trainer also targets keys missed in timed tests, not
   *  just low-strength letters. */
  missCounts?: Record<string, number>
}

/** Each recent miss adds this much weakness, capped so one noisy key can't dominate. */
const MISS_WEIGHT = 4
const MISS_CAP = 60

/** Real words typeable with only the unlocked letters. */
export function eligibleWords(unlocked: string[]): string[] {
  const set = new Set(unlocked)
  return WORD_LIST.filter((word) => {
    for (const ch of word) if (!set.has(ch)) return false
    return true
  })
}

function weaknessOf(
  letter: string,
  strength: Record<string, number>,
  missCounts?: Record<string, number>,
): number {
  const base = 100 - (strength[letter] ?? 0)
  const miss = missCounts?.[letter] ?? 0
  return base + Math.min(miss * MISS_WEIGHT, MISS_CAP)
}

/** sum(weakness) / length, with an optional 2× newest-letter boost (§4.2). */
function practiceValue(word: string, opts: LineOptions): number {
  let sum = 0
  for (const ch of word) sum += weaknessOf(ch, opts.strength, opts.missCounts)
  let value = sum / word.length
  if (opts.boostNewest && opts.newestLetter && word.includes(opts.newestLetter)) {
    value *= 2
  }
  // Keep strictly positive so every word retains some sampling chance.
  return Math.max(value, 0.01)
}

function weightedPick(items: string[], weights: number[], total: number, rng: Rng): string {
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!
    if (r <= 0) return items[i]!
  }
  return items[items.length - 1]!
}

/** Pick a single letter from a bucket, weighted toward the weaker letters. */
function pickLetter(bucket: string[], strength: Record<string, number>, rng: Rng): string {
  const weights = bucket.map((l) => Math.max(weaknessOf(l, strength), 1))
  const total = weights.reduce((a, b) => a + b, 0)
  return weightedPick(bucket, weights, total, rng)
}

/** A pronounceable pseudoword from the unlocked letters (§4.3). */
export function generatePseudoword(
  unlocked: string[],
  strength: Record<string, number>,
  rng: Rng = Math.random,
): string {
  const vowels = unlocked.filter((l) => VOWELS.has(l))
  const consonants = unlocked.filter((l) => !VOWELS.has(l))

  for (let attempt = 0; attempt < 6; attempt++) {
    const template = PSEUDO_TEMPLATES[Math.floor(rng() * PSEUDO_TEMPLATES.length)]!
    let word = ''
    for (const slot of template) {
      // If a bucket is empty (e.g. no vowels unlocked yet), draw from all letters.
      const bucket =
        slot === 'v'
          ? vowels.length > 0
            ? vowels
            : unlocked
          : consonants.length > 0
            ? consonants
            : unlocked
      word += pickLetter(bucket, strength, rng)
    }
    if (!PROFANITY.has(word)) return word
  }
  return unlocked.slice(0, 2).join('') || 'fj'
}

/** A pseudoword guaranteed to contain `letter` (for starved-letter exposure). */
function pseudowordWith(letter: string, opts: LineOptions, rng: Rng): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    const word = generatePseudoword(opts.unlocked, opts.strength, rng)
    if (word.includes(letter)) return word
  }
  const base = generatePseudoword(opts.unlocked, opts.strength, rng)
  const pos = Math.floor(rng() * (base.length + 1))
  return base.slice(0, pos) + letter + base.slice(pos)
}

/** Set of letters that appear in at least one eligible real word. */
function coveredLetters(eligible: string[]): Set<string> {
  const set = new Set<string>()
  for (const word of eligible) for (const ch of word) set.add(ch)
  return set
}

/** Real words, padded with pseudowords when the real-word pool is sparse. */
function buildPool(eligible: string[], opts: LineOptions, rng: Rng): string[] {
  if (eligible.length >= MIN_REAL_WORDS) return eligible
  const pool = [...eligible]
  const seen = new Set(pool)
  let guard = 0
  while (pool.length < MIN_REAL_WORDS && guard++ < MIN_REAL_WORDS * 10) {
    const pw = generatePseudoword(opts.unlocked, opts.strength, rng)
    if (!seen.has(pw)) {
      seen.add(pw)
      pool.push(pw)
    }
  }
  return pool
}

/** One practice line: 8–12 words, weighted toward weak keys, no immediate repeats. */
export function generateLine(opts: LineOptions, rng: Rng = Math.random): string {
  const eligible = opts.eligible ?? eligibleWords(opts.unlocked)
  let pool = buildPool(eligible, opts, rng)

  // Some unlocked letters (notably 'j' in the home row) appear in no real word,
  // so they'd never get practiced — stalling the unlock gate forever. Inject
  // targeted pseudowords for any such "starved" letter; weakness-weighting then
  // surfaces them often. Only checked for small pools (large pools cover every
  // letter), so this is free once enough letters are unlocked.
  if (eligible.length <= 1500) {
    const covered = coveredLetters(eligible)
    const starved = opts.unlocked.filter((l) => !covered.has(l))
    if (starved.length > 0) {
      pool = pool.slice()
      for (const letter of starved) {
        for (let i = 0; i < 3; i++) pool.push(pseudowordWith(letter, opts, rng))
      }
    }
  }

  const weights = pool.map((w) => practiceValue(w, opts))
  const total = weights.reduce((a, b) => a + b, 0)

  // Pseudowords (starved-letter filler like "jaga") are anything not in the real
  // eligible set. Cap how many land in a line so lines read as real English.
  const realSet = new Set(eligible)
  const isPseudo = (w: string) => !realSet.has(w)

  const span = WORDS_PER_LINE_MAX - WORDS_PER_LINE_MIN + 1
  const count = WORDS_PER_LINE_MIN + Math.floor(rng() * span)

  const words: string[] = []
  const usedPseudo = new Set<string>()
  let last = ''
  let guard = 0
  while (words.length < count) {
    const picked = weightedPick(pool, weights, total, rng)
    // Re-pick on an immediate repeat, or a pseudoword that repeats / exceeds the
    // per-line cap. guard caps the retries so a pseudoword-only pool can't spin.
    const pseudoBlocked =
      isPseudo(picked) && (usedPseudo.has(picked) || usedPseudo.size >= MAX_PSEUDO_PER_LINE)
    if ((picked === last || pseudoBlocked) && pool.length > 1 && guard++ < 50) continue
    guard = 0
    if (isPseudo(picked)) usedPseudo.add(picked)
    words.push(picked)
    last = picked
  }
  return words.join(' ')
}
