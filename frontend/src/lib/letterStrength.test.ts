import { describe, expect, it } from 'vitest'
import {
  computeStrength,
  pushSample,
  ROLLING_WINDOW,
  sampleCountsFrom,
  STRENGTH_WINDOW,
  strengthMapFrom,
  type KeyEvent,
} from './letterStrength'

const sample = (correct: boolean, reactionMs: number): KeyEvent => ({
  key: 'f',
  correct,
  reactionMs,
  timestamp: 0,
})

describe('computeStrength', () => {
  it('is 0 for an empty window', () => {
    expect(computeStrength([])).toBe(0)
  })

  it('is ~100 for fast, perfectly consistent, all-correct typing', () => {
    const samples = Array.from({ length: 40 }, () => sample(true, 150))
    expect(computeStrength(samples)).toBeCloseTo(100, 5)
  })

  it('weights accuracy at 50%: 50% correct + perfect speed/consistency = 75', () => {
    // 150ms everywhere → speed 100, stdDev 0 → consistency 100; half correct → accuracy 50.
    const samples = [
      ...Array.from({ length: 20 }, () => sample(true, 150)),
      ...Array.from({ length: 20 }, () => sample(false, 150)),
    ]
    // 50*0.5 + 100*0.35 + 100*0.15 = 75
    expect(computeStrength(samples)).toBeCloseTo(75, 5)
  })

  it('penalizes slow reactions through the speed sub-score', () => {
    const fast = Array.from({ length: 30 }, () => sample(true, 150))
    const slow = Array.from({ length: 30 }, () => sample(true, 800))
    expect(computeStrength(slow)).toBeLessThan(computeStrength(fast))
  })

  it('a single recent error lowers the score — progress is losable', () => {
    const clean = Array.from({ length: 20 }, () => sample(true, 150))
    const withMiss = [
      ...Array.from({ length: 19 }, () => sample(true, 150)),
      sample(false, 800),
    ]
    expect(computeStrength(withMiss)).toBeLessThan(computeStrength(clean) - 3)
  })
})

describe('pushSample', () => {
  it('caps the window at the rolling size', () => {
    let window: KeyEvent[] = []
    for (let i = 0; i < ROLLING_WINDOW + 25; i++) {
      window = pushSample(window, sample(true, 150))
    }
    expect(window).toHaveLength(ROLLING_WINDOW)
  })

  it('keeps the most recent samples', () => {
    let window: KeyEvent[] = []
    for (let i = 0; i < ROLLING_WINDOW + 1; i++) {
      window = pushSample(window, { ...sample(true, 150), timestamp: i })
    }
    expect(window[0]!.timestamp).toBe(1) // the very first (timestamp 0) was dropped
  })
})

describe('strengthMapFrom / sampleCountsFrom', () => {
  it('derive per-letter score and count', () => {
    const windows = { f: Array.from({ length: 10 }, () => sample(true, 150)) }
    expect(strengthMapFrom(windows).f).toBeCloseTo(100, 5)
    expect(sampleCountsFrom(windows).f).toBe(10)
  })

  it('scores only the most recent STRENGTH_WINDOW samples (old misses roll off)', () => {
    const oldMisses = Array.from({ length: 30 }, () => sample(false, 800))
    const recentClean = Array.from({ length: STRENGTH_WINDOW }, () => sample(true, 150))
    // 50-sample window, but only the last STRENGTH_WINDOW feed the score.
    expect(strengthMapFrom({ f: [...oldMisses, ...recentClean] }).f).toBeCloseTo(100, 5)
    // ...while the full history is still counted for the unlock gate.
    expect(sampleCountsFrom({ f: [...oldMisses, ...recentClean] }).f).toBe(30 + STRENGTH_WINDOW)
  })
})
