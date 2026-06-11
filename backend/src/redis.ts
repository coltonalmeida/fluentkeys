import { Redis } from 'ioredis'

// Cache layer only — every caller must tolerate Redis being down and fall
// back to Postgres. offline queue is disabled so calls fail fast instead of
// buffering forever when the server is unreachable.
let client: Redis | null = null
let warned = false

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 1000, 15000),
      lazyConnect: false,
    })
    client.on('error', (err) => {
      if (!warned) {
        console.warn('Redis unavailable, serving from Postgres:', err.message)
        warned = true
      }
    })
    client.on('ready', () => {
      warned = false
    })
  }
  return client
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return (await getRedis()?.get(key)) ?? null
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await getRedis()?.set(key, value, 'EX', ttlSeconds)
  } catch {
    /* cache miss next time; fine */
  }
}

export async function cacheDel(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  try {
    await getRedis()?.del(...keys)
  } catch {
    /* entries expire via TTL anyway */
  }
}
