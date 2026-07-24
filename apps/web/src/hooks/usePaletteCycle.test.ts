import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePaletteCycle } from './usePaletteCycle'

const original = window.matchMedia

afterEach(() => {
  window.matchMedia = original
  vi.useRealTimers()
})

function stubReducedMotion(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

describe('usePaletteCycle', () => {
  it('advances and wraps on the interval', () => {
    stubReducedMotion(false)
    vi.useFakeTimers()
    const { result } = renderHook(() => usePaletteCycle(3, 2000))
    expect(result.current).toBe(0)
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current).toBe(1)
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current).toBe(0) // 1 -> 2 -> wraps to 0
  })

  it('stays put under prefers-reduced-motion', () => {
    stubReducedMotion(true)
    vi.useFakeTimers()
    const { result } = renderHook(() => usePaletteCycle(3, 2000))
    act(() => vi.advanceTimersByTime(6000))
    expect(result.current).toBe(0)
  })

  it('does not advance a single-color palette', () => {
    stubReducedMotion(false)
    vi.useFakeTimers()
    const { result } = renderHook(() => usePaletteCycle(1, 2000))
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current).toBe(0)
  })

  it('does not advance while disabled', () => {
    stubReducedMotion(false)
    vi.useFakeTimers()
    const { result } = renderHook(() => usePaletteCycle(3, 2000, false))
    // One interval, not a whole cycle: a running timer would show 1 here, so
    // this cannot pass by wrapping back around to 0.
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current).toBe(0)
  })

  it('advances once enabled, and stops when disabled again', () => {
    stubReducedMotion(false)
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ on }: { on: boolean }) => usePaletteCycle(3, 2000, on), {
      initialProps: { on: true },
    })
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current).toBe(1)
    rerender({ on: false })
    expect(result.current).toBe(0)
    // Two more intervals: still 0 proves the timer was cleared, not merely reset.
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current).toBe(0)
  })
})
