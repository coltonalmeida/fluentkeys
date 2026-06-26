import type { TestMode } from '../hooks/useTypingTest'

/** Single source for the test-mode dropdowns (toolbar + leaderboard filter).
 *  Order matches the toolbar; labels are the display strings. */
export const TEST_MODES: Record<TestMode, { label: string }> = {
  words: { label: 'Words' },
  punctuation: { label: 'Punctuation' },
  numbers: { label: 'Numbers' },
  quotes: { label: 'Quotes' },
  code: { label: 'Code' },
}
