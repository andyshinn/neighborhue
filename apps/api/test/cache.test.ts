import { describe, expect, it } from 'vitest'
import { cacheControlFor, MAX_AGE_SECONDS, STALE_WHILE_REVALIDATE_SECONDS } from '../src/lib/cache'

describe('cacheControlFor', () => {
  it('caps freshness at a minute so an admin edit propagates quickly', () => {
    expect(cacheControlFor(86_400)).toBe('public, max-age=60, stale-while-revalidate=60')
  })

  it('spends the remaining budget on stale-while-revalidate when the day is nearly over', () => {
    expect(cacheControlFor(90)).toBe('public, max-age=60, stale-while-revalidate=30')
  })

  it('shrinks below the cap rather than promising freshness past the rotation', () => {
    expect(cacheControlFor(30)).toBe('public, max-age=30, stale-while-revalidate=0')
  })

  it('permits no cached reuse at the rotation instant', () => {
    expect(cacheControlFor(0)).toBe('public, max-age=0, stale-while-revalidate=0')
  })

  it('never lets a shared cache serve across a rotation without revalidating', () => {
    for (const seconds of [0, 1, 30, 59, 60, 61, 90, 119, 120, 121, 3600, 86_400]) {
      const cc = cacheControlFor(seconds)
      const maxAge = Number(cc.match(/max-age=(\d+)/)?.[1])
      const swr = Number(cc.match(/stale-while-revalidate=(\d+)/)?.[1])
      // max-age + stale-while-revalidate is the longest a cache may go without
      // reaching the origin; past the rotation it would be serving yesterday.
      expect(maxAge + swr, `seconds_until_rotation=${seconds}`).toBeLessThanOrEqual(seconds)
      expect(maxAge).toBeLessThanOrEqual(MAX_AGE_SECONDS)
      expect(swr).toBeLessThanOrEqual(STALE_WHILE_REVALIDATE_SECONDS)
    }
  })
})
