// Core letter-strength math — pure, no React/DOM, unit-testable. Implements the
// formula from typing-training-spec.md §2.2 exactly.

export interface KeyEvent {
  /** The expected character (lowercase letter). */
  key: string
  /** Whether the user hit the right key. */
  correct: boolean
  /** Time from the character becoming current to the keypress (ms). */
  reactionMs: number
  /** Unix ms, for decay calculations. */
  timestamp: number
}

/** Per-letter rolling window of the most recent samples. */
export type SampleWindows = Record<string, KeyEvent[]>

/** Full history kept per letter — storage + the unlock gate's sample count. */
export const ROLLING_WINDOW = 50

/**
 * Only the most recent samples feed the *score*. Smaller than the stored window
 * so a single mistake or slow key is a meaningful fraction (~5%) of the score —
 * progress is genuinely losable and recovers over ~20 good presses, rather than
 * being diluted away across 50 samples.
 */
export const STRENGTH_WINDOW = 20

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Strength 0–100 from a letter's sample window:
 *   accuracy 45% + speed 45% (sigmoid on median reaction) + consistency 10%.
 * The speed curve is steep — a ~750ms median reaction floors speed to 0 — so
 * slow words cost real strength (the longer you dwell on a word, the harsher).
 * Empty window → 0 (a never-practiced letter).
 */
export function computeStrength(samples: KeyEvent[]): number {
  if (samples.length === 0) return 0

  const total = samples.length
  const correct = samples.reduce((n, s) => n + (s.correct ? 1 : 0), 0)
  const accuracyScore = (correct / total) * 100

  const reactions = samples.map((s) => s.reactionMs)
  const speedScore = clamp(100 - (median(reactions) - 150) / 6, 0, 100)
  const consistencyScore = clamp(100 - stdDev(reactions) / 8, 0, 100)

  return accuracyScore * 0.45 + speedScore * 0.45 + consistencyScore * 0.1
}

/** Append a sample to a letter's window, trimming to the rolling size. */
export function pushSample(window: KeyEvent[] | undefined, event: KeyEvent): KeyEvent[] {
  const next = window ? [...window, event] : [event]
  return next.length > ROLLING_WINDOW ? next.slice(next.length - ROLLING_WINDOW) : next
}

/** Strength score per letter, computed over the recent STRENGTH_WINDOW samples. */
export function strengthMapFrom(windows: SampleWindows): Record<string, number> {
  const map: Record<string, number> = {}
  for (const [letter, window] of Object.entries(windows)) {
    map[letter] = computeStrength(window.slice(-STRENGTH_WINDOW))
  }
  return map
}

/** Total sample count per letter (gates unlocks, spec §3.1). */
export function sampleCountsFrom(windows: SampleWindows): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const [letter, window] of Object.entries(windows)) {
    counts[letter] = window.length
  }
  return counts
}

// --- Strength decay (FEATURE-ROADMAP #9) -----------------------------------
// Idle letters slowly fade so mastery reflects *current* skill. This is
// DISPLAY-ONLY: the decayed value never feeds the unlock gate (which keeps using
// the raw rolling-window strength), so a letter can never be re-locked by decay.

const DAY_MS = 86_400_000
/** No decay for the first day, then this many strength points lost per idle day. */
const DECAY_GRACE_DAYS = 1
const DECAY_PER_DAY = 3

/** Reduce a strength score by idle time since it was last practiced (floored at 0). */
export function applyDecay(strength: number, lastPracticedAt: number | null, now: number): number {
  if (lastPracticedAt == null) return strength
  const idleDays = (now - lastPracticedAt) / DAY_MS
  const effective = Math.max(0, idleDays - DECAY_GRACE_DAYS)
  return Math.max(0, strength - effective * DECAY_PER_DAY)
}

/** Most-recent sample timestamp per letter — when each was last practiced. */
export function lastPracticedFrom(windows: SampleWindows): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [letter, window] of Object.entries(windows)) {
    let max = 0
    for (const s of window) if (s.timestamp > max) max = s.timestamp
    if (max > 0) out[letter] = max
  }
  return out
}

/**
 * Strength map for *display*, with idle decay applied. Works for both signed-in
 * (cloud `recent_samples`) and anonymous (local snapshot) since both windows
 * carry per-sample timestamps. Keep gating on `strengthMapFrom` (undecayed).
 */
export function displayStrengthMap(windows: SampleWindows, now: number): Record<string, number> {
  const raw = strengthMapFrom(windows)
  const last = lastPracticedFrom(windows)
  const out: Record<string, number> = {}
  for (const [letter, score] of Object.entries(raw)) {
    out[letter] = applyDecay(score, last[letter] ?? null, now)
  }
  return out
}
