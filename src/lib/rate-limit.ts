// Simple in-memory, fixed-window rate limiter. Good enough for a single-instance
// deployment; swap for a Redis-backed limiter (e.g. @upstash/ratelimit) if the app
// ever runs across multiple serverless instances/regions, since counters here are
// per-process and reset on redeploy.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Periodically drop expired buckets so the map doesn't grow unbounded.
function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

let lastSweep = 0

/**
 * Returns true if the action identified by `key` is still allowed under the
 * `limit` requests per `windowMs` window, and records this attempt.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  if (now - lastSweep > windowMs) {
    sweep(now)
    lastSweep = now
  }

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (existing.count >= limit) return false

  existing.count += 1
  return true
}

/** Best-effort client IP extraction behind typical reverse proxies (Vercel, nginx). */
export function getClientIp(request: Request | { headers: Headers } | null | undefined): string {
  const headers = request?.headers
  const forwardedFor = headers?.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  const realIp = headers?.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}
