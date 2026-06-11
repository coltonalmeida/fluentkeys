export interface TestStats {
  wpm: number
  rawWpm: number
  accuracy: number
  correctChars: number
  incorrectChars: number
  totalKeystrokes: number
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
