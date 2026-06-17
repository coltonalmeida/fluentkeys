export interface TestStats {
  wpm: number
  rawWpm: number
  accuracy: number
  correctChars: number
  incorrectChars: number
  totalKeystrokes: number
}

/** One per-second snapshot of the test, used to draw the WPM-over-time graph. */
export interface WpmSample {
  /** elapsed seconds since the test started (1, 2, 3, …) */
  t: number
  /** net WPM from cumulative correct chars at this second */
  wpm: number
  /** raw WPM from all typed chars at this second */
  raw: number
  /** mistakes made during this one-second window */
  errors: number
}

/** Standard WPM: (correct chars / 5) per minute. Raw WPM counts all typed chars. */
export function computeStats(
  correctChars: number,
  incorrectChars: number,
  totalKeystrokes: number,
  elapsedSeconds: number,
): TestStats {
  const minutes = Math.max(elapsedSeconds, 1) / 60
  const typedChars = correctChars + incorrectChars
  return {
    wpm: Math.round((correctChars / 5 / minutes) * 100) / 100,
    rawWpm: Math.round((typedChars / 5 / minutes) * 100) / 100,
    accuracy:
      totalKeystrokes === 0
        ? 100
        : Math.round((correctChars / totalKeystrokes) * 10000) / 100,
    correctChars,
    incorrectChars,
    totalKeystrokes,
  }
}
