// Static word lists — no AI, no external API. Filterable by key set and difficulty.

export type KeySetId = 'home' | 'home-top' | 'all'
export type Difficulty = 'easy' | 'medium' | 'hard'

export const KEY_SETS: Record<KeySetId, { label: string; keys: ReadonlySet<string> }> = {
  home: { label: 'Home row', keys: new Set('asdfghjkl') },
  'home-top': { label: 'Home + top row', keys: new Set('asdfghjklqwertyuiop') },
  all: { label: 'All keys', keys: new Set('abcdefghijklmnopqrstuvwxyz') },
}

export const DIFFICULTIES: Record<Difficulty, { label: string; minLen: number; maxLen: number }> = {
  easy: { label: 'Easy', minLen: 2, maxLen: 4 },
  medium: { label: 'Medium', minLen: 4, maxLen: 7 },
  hard: { label: 'Hard', minLen: 6, maxLen: 14 },
}

export const WORDS: readonly string[] = [
  // short / common
  'as', 'ask', 'add', 'all', 'fall', 'glass', 'flag', 'salad', 'lads', 'gas',
  'had', 'has', 'hall', 'dash', 'sad', 'lad', 'fad', 'ash', 'gala', 'flash',
  'shall', 'half', 'glad', 'slash', 'haha', 'dad', 'lass', 'gaff', 'alas', 'fads',
  'jak', 'flask', 'shag', 'hash', 'gash', 'sash', 'dahl', 'gall', 'salsa', 'algas',
  // home + top row
  'this', 'that', 'with', 'they', 'will', 'would', 'there', 'their', 'what', 'were',
  'your', 'said', 'each', 'other', 'time', 'about', 'these', 'word', 'water', 'first',
  'people', 'though', 'right', 'their', 'after', 'where', 'little', 'world', 'house', 'great',
  'while', 'should', 'still', 'state', 'those', 'thought', 'group', 'guide', 'spirit', 'sport',
  'true', 'pretty', 'figure', 'paper', 'party', 'puts', 'quite', 'quiet', 'quote', 'quit',
  'tower', 'route', 'tutor', 'tissue', 'output', 'pursue', 'props', 'troupe', 'eight', 'sight',
  'higher', 'either', 'top', 'pot', 'two', 'too', 'out', 'put', 'pit', 'tip',
  'rust', 'trust', 'sport', 'short', 'store', 'story', 'study', 'style', 'sugar', 'super',
  // all keys
  'because', 'between', 'example', 'never', 'every', 'under', 'around', 'however', 'number', 'always',
  'family', 'system', 'question', 'government', 'company', 'problem', 'service', 'business', 'project', 'develop',
  'become', 'change', 'follow', 'create', 'provide', 'include', 'continue', 'consider', 'community', 'experience',
  'available', 'different', 'important', 'information', 'understand', 'knowledge', 'language', 'practice', 'keyboard', 'velocity',
  'zebra', 'quick', 'brown', 'jumps', 'lazy', 'oxygen', 'wizard', 'jacket', 'puzzle', 'boxer',
  'cycle', 'vivid', 'maximum', 'complex', 'object', 'subject', 'reject', 'inject', 'request', 'frequent',
  'amazing', 'crazy', 'breeze', 'freeze', 'sneeze', 'squeeze', 'exact', 'extra', 'expert', 'export',
  'very', 'voice', 'value', 'video', 'visit', 'cover', 'over', 'even', 'ever', 'give',
  'make', 'take', 'came', 'come', 'back', 'black', 'block', 'check', 'click', 'clock',
  'jump', 'just', 'jazz', 'enjoy', 'major', 'magic', 'image', 'money', 'many', 'name',
]

const wordIsTypable = (word: string, keys: ReadonlySet<string>): boolean =>
  [...word].every((ch) => keys.has(ch))

/** Words matching the key set and difficulty. Relaxes length bounds if too few match. */
export function filterWords(keySet: KeySetId, difficulty: Difficulty): string[] {
  const { keys } = KEY_SETS[keySet]
  const { minLen, maxLen } = DIFFICULTIES[difficulty]
  const typable = WORDS.filter((w) => wordIsTypable(w, keys))
  const filtered = typable.filter((w) => w.length >= minLen && w.length <= maxLen)
  // Fall back to any typable word rather than an empty pool
  return filtered.length >= 10 ? filtered : typable
}
