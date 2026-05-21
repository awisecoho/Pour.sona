import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Lazy-init so missing env vars crash at call time (→ catchable 429)
// rather than at module load time (→ uncatchable 503).
let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return _redis
}

/** Whether Upstash Redis is configured. When false, route-level limiters skip
 *  (the middleware applies a best-effort in-memory fallback instead). */
export function redisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function makeLimiter(prefix: string, limit: number, window: string) {
  let _limiter: Ratelimit | null = null
  return {
    limit: (id: string): Promise<{ success: boolean }> => {
      // Not configured: middleware owns throttling via its in-memory fallback,
      // so don't fail the request here. Avoids a 429 when Redis is absent.
      if (!redisConfigured()) return Promise.resolve({ success: true })
      if (!_limiter) {
        _limiter = new Ratelimit({
          redis: getRedis(),
          limiter: Ratelimit.slidingWindow(limit, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
          prefix,
        })
      }
      return _limiter.limit(id)
    },
  }
}

export const chatLimiter = makeLimiter('rl:chat', 20, '1 h')
export const onboardLimiter = makeLimiter('rl:onboard', 5, '1 h')
export const retailerLimiter = makeLimiter('rl:retailer', 120, '1 h')

export function getIp(req: Request): string {
  const fwd = (req as any).headers?.get?.('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return 'unknown'
}
