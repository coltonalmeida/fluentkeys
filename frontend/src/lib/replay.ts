import type { Trace } from './api'

/** Final caret index the trace reached (chars advance, backspaces retreat). Used
 *  to truncate a duel to where the creator actually ended (§3). */
export function reachedIndex(trace: Trace): number {
  let idx = 0
  for (const e of trace.events) {
    if (e.ch === '\b') {
      if (idx > 0) idx -= 1
    } else {
      idx += 1
    }
  }
  return idx
}

/**
 * Simulate a trace against its target to recover per-key accuracy (§27 heatmap).
 * The trace stores the *typed* char + ok flag; the *expected* char is recovered
 * by walking the target with the same index logic the test uses (chars advance,
 * backspaces retreat). Keyed by the expected character.
 */
export function perKeyAccuracy(trace: Trace): Record<string, { correct: number; total: number }> {
  const out: Record<string, { correct: number; total: number }> = {}
  let idx = 0
  for (const e of trace.events) {
    if (e.ch === '\b') {
      if (idx > 0) idx -= 1
      continue
    }
    const expected = trace.target[idx]
    if (expected && expected !== ' ' && expected !== '\n') {
      const bucket = (out[expected] ??= { correct: 0, total: 0 })
      bucket.total += 1
      if (e.ok) bucket.correct += 1
    }
    idx += 1
  }
  return out
}
