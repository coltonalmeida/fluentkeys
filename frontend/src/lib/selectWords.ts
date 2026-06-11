import { filterWords, type Difficulty, type KeySetId } from './words'

export interface SelectionOptions {
  keySet: KeySetId
  difficulty: Difficulty
  /** Miss counts per character — higher means weaker, gets more weight. */
  weakKeys?: Readonly<Record<string, number>>
  /** Keys the user recently unlocked — words containing them get a boost. */
  unlockedKeys?: ReadonlySet<string>
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

/** Weighted random selection: biases toward words containing weak and unlocked keys. */
export function generateWords(count: number, opts: SelectionOptions): string[] {
  const pool = filterWords(opts.keySet, opts.difficulty)
  const weights = pool.map((w) => wordWeight(w, opts))
  const total = weights.reduce((a, b) => a + b, 0)

  const result: string[] = []
  let last = ''
  while (result.length < count) {
    let r = Math.random() * total
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
