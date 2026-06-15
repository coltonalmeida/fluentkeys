// Persisted trainer state. localStorage is the always-available source (works
// for anonymous users); the backend sync for signed-in users is layered on in
// lib/api.ts. Both use this same TrainingState shape.

import type { SampleWindows } from './letterStrength'
import { STARTER_COUNT } from './unlocks'

export interface TrainingState {
  /** How many letters from UNLOCK_ORDER are unlocked. */
  unlockedCount: number
  /** Per-letter rolling windows of recent keystrokes. */
  windows: SampleWindows
}

const LS_KEY = 'fluentkeys.training.v1'

export function emptyTrainingState(): TrainingState {
  return { unlockedCount: STARTER_COUNT, windows: {} }
}

export function loadLocalTraining(): TrainingState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return emptyTrainingState()
    const parsed = JSON.parse(raw) as Partial<TrainingState>
    return {
      unlockedCount:
        typeof parsed.unlockedCount === 'number' ? parsed.unlockedCount : STARTER_COUNT,
      windows: parsed.windows && typeof parsed.windows === 'object' ? parsed.windows : {},
    }
  } catch {
    return emptyTrainingState()
  }
}

export function saveLocalTraining(state: TrainingState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    // Storage full or disabled — non-fatal; the session just won't persist.
  }
}
