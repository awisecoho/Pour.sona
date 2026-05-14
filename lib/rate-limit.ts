import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const chatLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'rl:chat',
})

export const onboardLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'rl:onboard',
})

export const retailerLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 h'),
  prefix: 'rl:retailer',
})

export function getIp(req: Request): string {
  const fwd = (req as any).headers?.get?.('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return 'unknown'
}
