export interface User {
  /** bigint ids arrive serialized as strings */
  id: string
  clerk_id: string
  email: string | null
  username: string | null
  /** ISO timestamp of the last rename; null if never renamed (or only set once). */
  username_changed_at: string | null
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// In dev this is unset and requests go through Vite's /api proxy. In
// production builds set VITE_API_URL to the deployed backend origin.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api'

/** Authenticated fetch — pass a Clerk session token from useAuth().getToken(). */
export async function apiRequest<T>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`)
  return body as T
}

export interface ResultPayload {
  keySet: string
  difficulty: string
  duration: number
  wpm: number
  accuracy: number
  rawWpm: number
  charCounts: Record<string, number>
}

export interface HistoryEntry {
  id: string
  wpm: string
  accuracy: string
  raw_wpm: string
  created_at: string
  key_set: string
  difficulty: string
  duration: number
}

export interface PersonalBest {
  key_set: string
  difficulty: string
  wpm: string
  accuracy: string
  achieved_at: string
}

export interface ResultResponse {
  resultId: string
  isPersonalBest: boolean
  newlyEarned: string[]
  xp: number
  level: number
  leveledUp: boolean
}

export const postResult = (token: string | null, payload: ResultPayload) =>
  apiRequest<ResultResponse>('/results', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const getHistory = (token: string | null, limit = 20) =>
  apiRequest<{ results: HistoryEntry[] }>(`/results?limit=${limit}`, token)

export const getPersonalBests = (token: string | null) =>
  apiRequest<{ personalBests: PersonalBest[] }>('/personal-bests', token)

export const getWeakKeys = (token: string | null) =>
  apiRequest<{ weakKeys: Record<string, number> }>('/weak-keys', token)

// Preferences sync (optional): the profile mirrors localStorage for signed-in
// users. `preferences` is null until the user has saved any.
export const getPreferences = (token: string | null) =>
  apiRequest<{ preferences: unknown | null }>('/auth/preferences', token)

export const putPreferences = (token: string | null, preferences: unknown) =>
  apiRequest<{ preferences: unknown }>('/auth/preferences', token, {
    method: 'PUT',
    body: JSON.stringify({ preferences }),
  })

export const getMe = (token: string | null) => apiRequest<{ user: User }>('/auth/me', token)

// Change/set the username through the backend (gated to once per week; Clerk
// stays the format + uniqueness authority). Distinguish failures by
// ApiError.status: 409 taken, 429 rate-limited, 400 invalid.
export const updateUsername = (token: string | null, username: string) =>
  apiRequest<{ username: string; nextChangeAllowedAt: string | null }>('/auth/username', token, {
    method: 'PUT',
    body: JSON.stringify({ username }),
  })

// Letter-strength trainer sync. localStorage is the always-available store;
// this mirrors it to the cloud DB for signed-in users (cross-device).
export interface TrainingSample {
  key: string
  correct: boolean
  reactionMs: number
  timestamp: number
}

export interface TrainingStateResponse {
  unlockedCount: number
  windows: Record<string, TrainingSample[]>
}

export interface TrainingSessionPayload {
  unlockedCount: number
  letters: { letter: string; strength: number; samples: TrainingSample[] }[]
  session: {
    wordsTyped: number
    peakWpm: number
    avgAccuracy: number
    newUnlocks: string[]
    startedAt: number
  }
}

export const getTrainingState = (token: string | null) =>
  apiRequest<TrainingStateResponse>('/training/state', token)

// Migrate guest (anonymous) trainer progress into the account on first sign-in
// (§19). Upserts letter windows + unlock index only — no session/XP/achievements.
export const postTrainingImport = (
  token: string | null,
  payload: { unlockedCount: number; letters: TrainingSessionPayload['letters'] },
) =>
  apiRequest<{ ok: boolean }>('/training/import', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const postTrainingSession = (token: string | null, payload: TrainingSessionPayload) =>
  apiRequest<{ ok: boolean; newlyEarned: string[]; xp: number; level: number; leveledUp: boolean }>(
    '/training/session',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )

// Progression: XP/level + earned cosmetics + streak-freeze tokens (§15/§16/§11).
export interface Progression {
  xp: number
  level: number
  levelXp: number
  nextLevelXp: number
  streakFreezes: number
  ownedCosmetics: string[]
}

export const getProgression = (token: string | null) =>
  apiRequest<Progression>('/progression', token)

export interface EarnedAchievement {
  key: string
  earnedAt: string
}

export const getAchievements = (token: string | null) =>
  apiRequest<{ earned: EarnedAchievement[] }>('/achievements', token)

// Profile statistics + activity heatmap. Aggregated server-side over both
// activity streams (timed practice tests + trainer lessons). Speed/accuracy are
// null when there's no activity in the bucket.
export interface StatBucket {
  timeSeconds: number
  lessons: number
  topWpm: number | null
  avgWpm: number | null
  topAccuracy: number | null
  avgAccuracy: number | null
}

export interface StatsOverview {
  allTime: StatBucket
  today: StatBucket
  /** Calendar years with activity (plus the current year), newest first. */
  years: number[]
}

export interface DayActivity {
  /** 'YYYY-MM-DD' in the requested time zone. */
  date: string
  tests: number
  lessons: number
  count: number
}

/** Pass the browser's IANA zone: Intl.DateTimeFormat().resolvedOptions().timeZone. */
export const getStatsOverview = (token: string | null, tz: string) =>
  apiRequest<StatsOverview>(`/stats/overview?tz=${encodeURIComponent(tz)}`, token)

export interface StreakResponse {
  current: number
  longest: number
  /** Seconds practiced today (tz-local), compared against the client daily goal. */
  todaySeconds: number
  /** Unused streak-freeze tokens (§11). */
  streakFreezes: number
}

export const getStreak = (token: string | null, tz: string) =>
  apiRequest<StreakResponse>(`/stats/streak?tz=${encodeURIComponent(tz)}`, token)

export interface WpmDayPoint {
  day: string
  avgWpm: number
  bestWpm: number
}

export const getWpmSeries = (token: string | null, days: number, tz: string) =>
  apiRequest<{ series: WpmDayPoint[] }>(
    `/stats/wpm-series?days=${days}&tz=${encodeURIComponent(tz)}`,
    token,
  )

export const getActivity = (token: string | null, tz: string, year?: number) =>
  apiRequest<{ days: DayActivity[] }>(
    `/stats/activity?tz=${encodeURIComponent(tz)}${year ? `&year=${year}` : ''}`,
    token,
  )

// Deeper analytics (§26).
export interface HourPoint {
  hour: number
  avgWpm: number
  tests: number
}

export const getStatsByHour = (token: string | null, tz: string) =>
  apiRequest<{ byHour: HourPoint[] }>(`/stats/by-hour?tz=${encodeURIComponent(tz)}`, token)

export interface Consistency {
  score: number | null
  sampleSize: number
  avgWpm: number | null
}

export const getConsistency = (token: string | null) =>
  apiRequest<Consistency>('/stats/consistency', token)

// Public, read-only profile (§2) — no auth needed. Mirrors the signed-in profile
// but privacy-trimmed (no email / Clerk id).
export interface PublicProfile {
  id: string
  username: string
  joinedAt: string
  level: number
  topWpm: number
  totalTests: number
  badge: string | null
  frame: string | null
  pbs: PersonalBest[]
  achievements: EarnedAchievement[]
  activity: DayActivity[]
}

export const getPublicProfile = (username: string) =>
  apiRequest<PublicProfile>(`/users/${encodeURIComponent(username)}/profile`, null)

// Daily challenge (§9): one shared seeded test per UTC day + its own leaderboard.
export interface DailyConfig {
  date: string
  seed: number
  keySet: string
  difficulty: string
  duration: number
  mode: string
  codeLanguage: string
  yourBest: { wpm: number; accuracy: number } | null
}

export interface DailyLeaderboardEntry {
  username: string | null
  wpm: string
  accuracy: string
  created_at: string
}

export const getDaily = (token: string | null) => apiRequest<DailyConfig>('/daily', token)

export const getDailyLeaderboard = (date?: string) =>
  apiRequest<{ date: string; entries: DailyLeaderboardEntry[] }>(
    `/daily/leaderboard${date ? `?date=${encodeURIComponent(date)}` : ''}`,
    null,
  )

export const postDailyResult = (
  token: string | null,
  payload: { wpm: number; accuracy: number; rawWpm: number },
) =>
  apiRequest<{ date: string; isBest: boolean }>('/daily/result', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

// Keystroke traces (§27) — replay + per-key heatmap; also the duel ghost (§3).
export interface TraceEvent {
  /** ms since the first keystroke */
  t: number
  /** typed character, or '\b' for backspace */
  ch: string
  /** matched the expected character */
  ok: boolean
}

export interface Trace {
  target: string
  durationSeconds: number
  events: TraceEvent[]
}

export const postTrace = (token: string | null, resultId: string, trace: Trace) =>
  apiRequest<{ ok: boolean }>(`/results/${resultId}/trace`, token, {
    method: 'POST',
    body: JSON.stringify(trace),
  })

export const getTrace = (resultId: string) =>
  apiRequest<{ trace: Trace }>(`/results/${resultId}/trace`, null)

// Public shared result (§1) — privacy-trimmed single result by id.
export interface SharedResult {
  id: string
  username: string | null
  wpm: number
  accuracy: number
  rawWpm: number
  keySet: string
  difficulty: string
  duration: number
  createdAt: string
}

export const getSharedResult = (id: string) => apiRequest<SharedResult>(`/results/${id}`, null)

// Duels (§3): create from a finished test, then anyone can race the ghost.
export interface DuelData {
  code: string
  target: string
  duration: number
  creatorUsername: string | null
  creatorWpm: number
  creatorAccuracy: number
  events: TraceEvent[]
}

export const createDuel = (
  token: string | null,
  payload: { target: string; durationSeconds: number; events: TraceEvent[]; wpm: number; accuracy: number },
) =>
  apiRequest<{ code: string }>('/duels', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const getDuel = (code: string) =>
  apiRequest<DuelData>(`/duels/${encodeURIComponent(code)}`, null)

// Referral / invite loop (§4).
export interface ReferralInfo {
  code: string
  successfulReferrals: number
}

export const getReferralMe = (token: string | null) =>
  apiRequest<ReferralInfo>('/referrals/me', token)

export const redeemReferral = (token: string | null, code: string) =>
  apiRequest<{ redeemed: boolean }>('/referrals/redeem', token, {
    method: 'POST',
    body: JSON.stringify({ code }),
  })

export interface LeaderboardEntry {
  username: string | null
  wpm: string
  accuracy: string
  created_at: string
}

export type LeaderboardWindow = 'all' | 'day' | 'week' | 'season'
export type LeaderboardScope = 'global' | 'friends'

export const getLeaderboard = (
  token: string | null,
  keySet: string,
  difficulty: string,
  window: LeaderboardWindow,
  scope: LeaderboardScope = 'global',
  /** Explicit 'YYYY-MM' archive month; overrides the window's time filter (§12). */
  season?: string,
) =>
  apiRequest<{ entries: LeaderboardEntry[] }>(
    `/leaderboard?keySet=${keySet}&difficulty=${difficulty}&window=${window}&scope=${scope}` +
      (season ? `&season=${encodeURIComponent(season)}` : ''),
    token,
  )

/** Distinct seasons (months) present on the leaderboard, newest first (§12). */
export const getSeasons = () => apiRequest<{ seasons: string[] }>('/seasons', null)

export interface UserSummary {
  id: string
  username: string | null
}

export const searchUsers = (token: string | null, q: string) =>
  apiRequest<{ users: UserSummary[] }>(`/users/search?q=${encodeURIComponent(q)}`, token)

export const getFollows = (token: string | null) =>
  apiRequest<{ follows: UserSummary[] }>('/follows', token)

export const follow = (token: string | null, followeeId: string) =>
  apiRequest<{ ok: boolean }>('/follows', token, {
    method: 'POST',
    body: JSON.stringify({ followeeId }),
  })

export const unfollow = (token: string | null, followeeId: string) =>
  apiRequest<{ ok: boolean }>('/follows', token, {
    method: 'DELETE',
    body: JSON.stringify({ followeeId }),
  })
