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
  // WPM ladder
  { key: 'first_50_wpm', label: 'Warmed Up', description: 'Hit 50 WPM in a test', icon: '🚗' },
  { key: 'first_80_wpm', label: 'Cruising', description: 'Hit 80 WPM in a test', icon: '🏎️' },
  { key: 'first_100_wpm', label: 'Century', description: 'Hit 100 WPM in a test', icon: '💯' },
  { key: 'first_120_wpm', label: 'Supersonic', description: 'Hit 120 WPM in a test', icon: '🚀' },
  // Streak ladder
  { key: 'seven_day_streak', label: 'Habit', description: 'Practice 7 days in a row', icon: '🔥' },
  { key: 'thirty_day_streak', label: 'Devoted', description: 'Practice 30 days in a row', icon: '⚡' },
  { key: 'hundred_day_streak', label: 'Centurion', description: 'Practice 100 days in a row', icon: '🏛️' },
  // Trainer progression
  { key: 'all_letters', label: 'Full Alphabet', description: 'Unlock all 26 letters', icon: '🔤' },
  // Words-typed ladder
  { key: 'thousand_words', label: 'Wordsmith', description: 'Type 1,000 words', icon: '📝' },
  { key: 'ten_thousand_words', label: 'Marathon', description: 'Type 10,000 words', icon: '🏃' },
  { key: 'fifty_thousand_words', label: 'Novelist', description: 'Type 50,000 words', icon: '📚' },
  // Accuracy
  { key: 'flawless', label: 'Flawless', description: '100% accuracy on a 30s+ test', icon: '✨' },
  // Level milestones
  { key: 'level_5', label: 'Apprentice', description: 'Reach level 5', icon: '🌱' },
  { key: 'level_10', label: 'Adept', description: 'Reach level 10', icon: '🌟' },
  { key: 'level_25', label: 'Master', description: 'Reach level 25', icon: '👑' },
]

const BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]))

export const achievementLabel = (key: string): string => BY_KEY.get(key)?.label ?? key
