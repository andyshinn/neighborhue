import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdown } from './useCountdown'

// Fixed "now" so the absolute-timestamp math is deterministic.
const NOW = new Date('2026-07-20T12:00:00.000Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useCountdown', () => {
  it('returns the SSR seed on the first render (hydration must match)', () => {
    const target = new Date(NOW + 500_000).toISOString()
    const { result } = renderHook(() => useCountdown(12345, target, () => {}))
    expect(result.current).toBe(12345)
  })

  it('recomputes from the absolute timestamp after mount, ignoring a stale seed', () => {
    const target = new Date(NOW + 60_000).toISOString() // 60s away
    const { result } = renderHook(() => useCountdown(99999, target, () => {}))
    act(() => {
      vi.advanceTimersByTime(0) // let the mount effect run
    })
    expect(result.current).toBe(60)
  })

  it('ticks down once per second', () => {
    const target = new Date(NOW + 60_000).toISOString()
    const { result } = renderHook(() => useCountdown(60, target, () => {}))
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current).toBe(57)
  })

  it('clamps at zero and fires onExpire exactly once', () => {
    const onExpire = vi.fn()
    const target = new Date(NOW + 2000).toISOString()
    const { result } = renderHook(() => useCountdown(2, target, onExpire))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current).toBe(0)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('fires onExpire when it mounts already past the rotation moment', () => {
    const onExpire = vi.fn()
    const target = new Date(NOW - 1000).toISOString()
    renderHook(() => useCountdown(0, target, onExpire))
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(onExpire).toHaveBeenCalledTimes(1)
  })
})
