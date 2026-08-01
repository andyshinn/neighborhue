// Cache policy for the public read route.
//
// The color is stable for a whole color-day, which tempts `max-age` all the way
// to the next rotation. But the body is not a pure function of the clock — an
// admin can PATCH the palette, custom colors, name, timezone, or rotation hour
// at any moment. A day-long freshness window lets a shared cache keep serving
// the pre-change body without ever asking us, and no ETag can fix that: a fresh
// cached response is never revalidated.
//
// So freshness is short and revalidation is cheap. A conditional revalidation
// costs one 304 with no body, which is what the ETag is for.
//
// `must-revalidate` would NOT solve this — it only governs what a cache may do
// once a response is already stale, and says nothing about the freshness window
// itself. Shortening the window is the part that matters.
export const MAX_AGE_SECONDS = 60
export const STALE_WHILE_REVALIDATE_SECONDS = 60

// `max-age + stale-while-revalidate` is the longest a shared cache may go
// without reaching the origin, so both are clamped to keep that sum inside the
// current color-day. Otherwise a cache could serve yesterday's color across a
// rotation boundary.
export function cacheControlFor(secondsUntilRotation: number): string {
  const remaining = Math.max(0, secondsUntilRotation)
  const maxAge = Math.min(MAX_AGE_SECONDS, remaining)
  const staleWhileRevalidate = Math.min(STALE_WHILE_REVALIDATE_SECONDS, remaining - maxAge)
  return `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
}
