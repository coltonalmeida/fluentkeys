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

export const postResult = (token: string | null, payload: ResultPayload) =>
  apiRequest<{ resultId: string; isPersonalBest: boolean; newlyEarned: string[] }>(
    '/results',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )

export const getHistory = (token: string | null) =>
  apiRequest<{ results: HistoryEntry[] }>('/results', token)

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

export const postTrainingSession = (token: string | null, payload: TrainingSessionPayload) =>
  apiRequest<{ ok: boolean; newlyEarned: string[] }>('/training/session', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

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

export interface LeaderboardEntry {
  username: string | null
  wpm: string
  accuracy: string
  created_at: string
}

export type LeaderboardWindow = 'all' | 'day' | 'week'
export type LeaderboardScope = 'global' | 'friends'

export const getLeaderboard = (
  token: string | null,
  keySet: string,
  difficulty: string,
  window: LeaderboardWindow,
  scope: LeaderboardScope = 'global',
) =>
  apiRequest<{ entries: LeaderboardEntry[] }>(
    `/leaderboard?keySet=${keySet}&difficulty=${difficulty}&window=${window}&scope=${scope}`,
    token,
  )

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
