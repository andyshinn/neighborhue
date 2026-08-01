import { useEffect, useRef, useState } from 'react'

/**
 * Live countdown to the next rotation.
 *
 * Ticks from the ABSOLUTE `nextRotationAt` timestamp, never from a relative
 * seconds value (spec S6): the API sets `Cache-Control: max-age=
 * seconds_until_rotation`, so a cached response carries a stale relative count
 * and would produce a countdown wrong by however long it sat in cache.
 *
 * `seedSeconds` is the server-rendered value. It is used for the first render
 * only, so hydrated HTML matches the server byte-for-byte (spec S7); the mount
 * effect then recomputes from the absolute timestamp, silently correcting any
 * clock skew.
 *
 * A null `nextRotationAt` means "no rotation to count toward yet" — the hook
 * holds the seed and never ticks. Home's fallback card uses this: it renders a
 * placeholder on the server, then supplies a client-computed target on mount.
 */
export function useCountdown(seedSeconds: number, nextRotationAt: string | null, onExpire: () => void): number {
  const [seconds, setSeconds] = useState(seedSeconds)

  // Held in a ref so a caller re-creating the callback doesn't restart the timer.
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (nextRotationAt === null) return
    const target = new Date(nextRotationAt).getTime()
    if (Number.isNaN(target)) return
    const remaining = () => Math.max(0, Math.round((target - Date.now()) / 1000))

    let fired = false
    const expireOnce = () => {
      if (fired) return
      fired = true
      onExpireRef.current()
    }

    let intervalId: ReturnType<typeof setInterval> | undefined

    const tick = () => {
      const next = remaining()
      setSeconds(next)
      if (next <= 0) {
        if (intervalId !== undefined) clearInterval(intervalId)
        expireOnce()
      }
    }

    // Defer the first correction to a macrotask rather than calling it
    // synchronously in the effect body. A zero-delay timer guarantees the
    // seeded value is the one actually committed and observable for that
    // first render (spec S7) — the fix runs on the next tick, once the seed
    // has already had its turn.
    const timeoutId = setTimeout(tick, 0)
    intervalId = setInterval(tick, 1000)

    return () => {
      clearTimeout(timeoutId)
      if (intervalId !== undefined) clearInterval(intervalId)
    }
  }, [nextRotationAt])

  return seconds
}
