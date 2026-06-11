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

/** Authenticated fetch — pass a Clerk session token from useAuth().getToken(). */
export async function apiRequest<T>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
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
