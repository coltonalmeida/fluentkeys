// Bundled public-domain quotes for the quotes practice mode (English only — the
// UI is i18n'd, content is not; non-English content is a separate effort). No AI,
// no external API; same static-content rule as the word lists.

export interface Quote {
  text: string
  author: string
}

export const QUOTES: readonly Quote[] = [
  { text: 'It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife.', author: 'Jane Austen' },
  { text: 'All that we see or seem is but a dream within a dream.', author: 'Edgar Allan Poe' },
  { text: 'The only way to do great work is to love what you do.', author: 'Anonymous' },
  { text: 'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.', author: 'Ralph Waldo Emerson' },
  { text: 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.', author: 'Charles Dickens' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'We are what we repeatedly do; excellence, then, is not an act but a habit.', author: 'Aristotle' },
  { text: 'The journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'Call me Ishmael. Some years ago, never mind how long precisely, I thought I would sail about a little and see the watery part of the world.', author: 'Herman Melville' },
  { text: 'Two roads diverged in a wood, and I took the one less traveled by, and that has made all the difference.', author: 'Robert Frost' },
  { text: 'Happiness depends upon ourselves, and the unexamined life is not worth living.', author: 'Socrates' },
  { text: 'The world breaks everyone, and afterward many are strong at the broken places.', author: 'Ernest Hemingway' },
  { text: 'Whether you think you can or you think you cannot, you are right either way.', author: 'Henry Ford' },
  { text: 'Not all those who wander are lost; the old that is strong does not wither.', author: 'J. R. R. Tolkien' },
  { text: 'I have not failed. I have just found ten thousand ways that will not work.', author: 'Thomas Edison' },
]

const wordCount = (s: string) => s.trim().split(/\s+/).length

/** A quote whose word count is closest to the requested length. */
export function pickQuote(targetWords: number): Quote {
  let best = QUOTES[0]!
  let bestDiff = Infinity
  for (const q of QUOTES) {
    const diff = Math.abs(wordCount(q.text) - targetWords)
    if (diff < bestDiff) {
      bestDiff = diff
      best = q
    }
  }
  return best
}

/**
 * Build target text for timed quote mode: concatenate distinct random quotes
 * until at least `targetWords` words are reached. Returns the text plus the set
 * of authors used (for results-screen attribution).
 */
export function buildQuoteTarget(targetWords: number): { text: string; authors: string[] } {
  // Short targets: a single closest-length quote reads better than a fragment.
  if (targetWords <= 25) {
    const q = pickQuote(targetWords)
    return { text: q.text, authors: [q.author] }
  }

  const parts: string[] = []
  const authors = new Set<string>()
  let words = 0
  const pool = [...QUOTES]
  while (words < targetWords && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length)
    const q = pool.splice(idx, 1)[0]!
    parts.push(q.text)
    authors.add(q.author)
    words += wordCount(q.text)
    if (pool.length === 0 && words < targetWords) pool.push(...QUOTES) // allow reuse to fill
  }
  return { text: parts.join(' '), authors: [...authors] }
}
