export interface User {
  /** bigint ids arrive serialized as strings */
  id: string
  clerk_id: string
  email: string | null
  username: string | null
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
  apiRequest<{ resultId: string; isPersonalBest: boolean }>('/results', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

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
  apiRequest<{ ok: boolean }>('/training/session', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export interface LeaderboardEntry {
  username: string | null
  wpm: string
  accuracy: string
  created_at: string
}

export type LeaderboardWindow = 'all' | 'day' | 'week'

export const getLeaderboard = (keySet: string, difficulty: string, window: LeaderboardWindow) =>
  apiRequest<{ entries: LeaderboardEntry[] }>(
    `/leaderboard?keySet=${keySet}&difficulty=${difficulty}&window=${window}`,
    null,
  )
