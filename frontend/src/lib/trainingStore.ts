// Persisted trainer state. Signed-in users keep it in localStorage (and it syncs
// to the cloud via lib/api.ts); anonymous users keep it in sessionStorage so their
// progress is intentionally cleared when the browser session ends. Only one store
// ever holds the data — saving to one clears the other.

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
    const raw = localStorage.getItem(LS_KEY) ?? sessionStorage.getItem(LS_KEY)
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

/** `persistent` (signed-in) → localStorage; anonymous → sessionStorage. The other
 *  store is cleared so progress can't linger across sessions for anonymous users. */
export function saveLocalTraining(state: TrainingState, persistent: boolean): void {
  try {
    const [target, other] = persistent
      ? [localStorage, sessionStorage]
      : [sessionStorage, localStorage]
    target.setItem(LS_KEY, JSON.stringify(state))
    other.removeItem(LS_KEY)
  } catch {
    // Storage full or disabled — non-fatal; the session just won't persist.
  }
}
