// Achievement presentation (FEATURE-ROADMAP #5). The backend owns the keys and
// the earn rules; the frontend owns the labels/descriptions shown on the profile
// grid and the unlock toast. Keys must match backend ACHIEVEMENT_KEYS.

export interface AchievementDef {
  key: string
  label: string
  description: string
  icon: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'first_100_wpm', label: 'Century', description: 'Hit 100 WPM in a test', icon: '💯' },
  { key: 'seven_day_streak', label: 'Habit', description: 'Practice 7 days in a row', icon: '🔥' },
  { key: 'all_letters', label: 'Full Alphabet', description: 'Unlock all 26 letters', icon: '🔤' },
  { key: 'ten_thousand_words', label: 'Marathon', description: 'Type 10,000 words', icon: '🏃' },
  { key: 'flawless', label: 'Flawless', description: '100% accuracy on a 30s+ test', icon: '✨' },
]

const BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]))

export const achievementLabel = (key: string): string => BY_KEY.get(key)?.label ?? key
