import { filterWords, type Difficulty, type KeySetId } from './words'

export interface SelectionOptions {
  keySet: KeySetId
  difficulty: Difficulty
  /** Miss counts per character — higher means weaker, gets more weight. */
  weakKeys?: Readonly<Record<string, number>>
  /** Keys the user recently unlocked — words containing them get a boost. */
  unlockedKeys?: ReadonlySet<string>
  /** Seeded RNG for deterministic output (daily challenge / duels). Defaults to
   *  Math.random. When set, callers typically omit weakKeys so the stream is
   *  identical for every user. */
  rng?: () => number
}

const WEAK_KEY_WEIGHT = 2
const UNLOCKED_KEY_WEIGHT = 1.5

function wordWeight(word: string, opts: SelectionOptions): number {
  let weight = 1
  for (const ch of word) {
    weight += (opts.weakKeys?.[ch] ?? 0) * WEAK_KEY_WEIGHT
    if (opts.unlockedKeys?.has(ch)) weight += UNLOCKED_KEY_WEIGHT
  }
  return weight
}

const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
const TERMINALS = ['.', '.', '.', '.', '?', '!'] // weighted toward periods

/**
 * Wrap a plain weighted word stream in sentence punctuation: capitalized starts,
 * occasional commas/semicolons, and a terminal mark every few words. The weak-key
 * biasing already happened in `generateWords` — this only decorates.
 */
export function applyPunctuation(words: string[], rng: () => number = Math.random): string {
  const out: string[] = []
  let inSentence = 0
  let target = 4 + Math.floor(rng() * 5)
  let startNew = true

  for (const raw of words) {
    let w = raw
    if (startNew) {
      w = capitalize(w)
      startNew = false
      inSentence = 0
    }
    inSentence += 1
    if (inSentence > 1 && inSentence < target && rng() < 0.12) {
      w += rng() < 0.7 ? ',' : ';'
    }
    if (inSentence >= target) {
      w += TERMINALS[Math.floor(rng() * TERMINALS.length)]
      startNew = true
      target = 4 + Math.floor(rng() * 5)
    }
    out.push(w)
  }

  // Guarantee the passage ends on a terminal mark.
  const last = out.length - 1
  if (last >= 0 && !/[.?!]$/.test(out[last]!)) out[last] = `${out[last]!.replace(/[,;]$/, '')}.`
  return out.join(' ')
}

function randomDigits(rng: () => number): string {
  const len = 2 + Math.floor(rng() * 3) // 2–4 digit groups
  let s = ''
  for (let i = 0; i < len; i++) s += Math.floor(rng() * 10)
  return s
}

/** Interleave random digit groups into the word stream (keeps the weak-key bias). */
export function applyNumbers(words: string[], rng: () => number = Math.random): string {
  const out: string[] = []
  for (const w of words) {
    out.push(w)
    if (rng() < 0.25) out.push(randomDigits(rng))
  }
  return out.join(' ')
}

/** Weighted random selection: biases toward words containing weak and unlocked keys. */
export function generateWords(count: number, opts: SelectionOptions): string[] {
  const rand = opts.rng ?? Math.random
  const pool = filterWords(opts.keySet, opts.difficulty)
  const weights = pool.map((w) => wordWeight(w, opts))
  const total = weights.reduce((a, b) => a + b, 0)

  const result: string[] = []
  let last = ''
  while (result.length < count) {
    let r = rand() * total
    let picked = pool[0] ?? ''
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i] ?? 0
      if (r <= 0) {
        picked = pool[i] ?? picked
        break
      }
    }
    if (picked === last && pool.length > 1) continue // avoid immediate repeats
    result.push(picked)
    last = picked
  }
  return result
}
